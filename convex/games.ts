import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const REVEAL_ROUNDS = new Set([3, 8, 13, 18]);

// Detective starting positions (from the standard Scotland Yard board)
const DETECTIVE_STARTS = [13, 26, 29, 34, 50, 53, 91, 94, 103, 112, 117, 132, 138, 141, 155, 174, 197, 198];
// Mr. X possible starting positions (not overlapping detective starts)
const MRX_STARTS = [35, 45, 51, 71, 78, 104, 106, 127, 166, 170, 172];

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export const getGameByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();
  },
});

export const getGameState = query({
  args: { gameId: v.id("games"), sessionId: v.string() },
  handler: async (ctx, { gameId, sessionId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();

    const me = players.find((p) => p.sessionId === sessionId);
    const isMrX = me?.isMrX ?? false;
    const isFinished = game.status === "finished";

    return {
      ...game,
      // Hide Mr. X position unless viewer is Mr. X or game is over
      mrxPosition: isMrX || isFinished ? game.mrxPosition : undefined,
      players,
      me,
    };
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const createGame = mutation({
  args: { sessionId: v.string(), playerName: v.string() },
  handler: async (ctx, { sessionId, playerName }) => {
    // Generate unique code
    let code = randomCode();
    while (await ctx.db.query("games").withIndex("by_code", (q) => q.eq("code", code)).first()) {
      code = randomCode();
    }

    const gameId = await ctx.db.insert("games", {
      code,
      status: "lobby",
      round: 1,
      phase: "mrx",
      currentDetectiveIdx: 0,
      doubleMovePending: false,
      mrxPosition: 0,
      mrxLog: [],
      detectives: [],
      mrxBlackTickets: 4,
      mrxDoubleMoveTickets: 2,
    });

    await ctx.db.insert("players", {
      gameId,
      sessionId,
      name: playerName,
      isMrX: false,
      detectiveIndices: [],
      isHost: true,
    });

    return { gameId, code };
  },
});

export const joinGame = mutation({
  args: { sessionId: v.string(), playerName: v.string(), code: v.string() },
  handler: async (ctx, { sessionId, playerName, code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();
    if (!game) throw new Error("Room not found");
    if (game.status !== "lobby") throw new Error("Game already started");

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    if (players.length >= 6) throw new Error("Room is full (max 6 players)");

    // Check if already in the game
    const existing = players.find((p) => p.sessionId === sessionId);
    if (existing) return { gameId: game._id, code: game.code };

    await ctx.db.insert("players", {
      gameId: game._id,
      sessionId,
      name: playerName,
      isMrX: false,
      detectiveIndices: [],
      isHost: false,
    });

    return { gameId: game._id, code: game.code };
  },
});

export const startGame = mutation({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
    mrxSessionId: v.string(), // which player becomes Mr. X
  },
  handler: async (ctx, { gameId, sessionId, mrxSessionId }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "lobby") throw new Error("Game already started");

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();

    const host = players.find((p) => p.sessionId === sessionId);
    if (!host?.isHost) throw new Error("Only the host can start the game");
    if (players.length < 2) throw new Error("Need at least 2 players");

    const mrxPlayer = players.find((p) => p.sessionId === mrxSessionId);
    if (!mrxPlayer) throw new Error("Mr. X player not found");

    const detectives = players.filter((p) => p.sessionId !== mrxSessionId);

    // Assign detective indices across detective players (always exactly 5 detectives)
    // Distribute 5 detectives among players as evenly as possible
    const detectiveAssignments: number[][] = Array.from({ length: detectives.length }, () => []);
    for (let i = 0; i < 5; i++) {
      detectiveAssignments[i % detectives.length].push(i);
    }

    // Pick starting positions
    const shuffledDetectiveStarts = shuffle(DETECTIVE_STARTS).slice(0, 5);
    const shuffledMrXStarts = shuffle(MRX_STARTS);
    const mrxStart = shuffledMrXStarts[0];

    // Create 5 detective objects
    const detectiveObjects = shuffledDetectiveStarts.map((pos) => ({
      position: pos,
      taxi: 10,
      bus: 8,
      underground: 4,
    }));

    // Update game
    await ctx.db.patch(gameId, {
      status: "playing",
      phase: "mrx",
      round: 1,
      mrxPosition: mrxStart,
      detectives: detectiveObjects,
      mrxBlackTickets: 4,
      mrxDoubleMoveTickets: 2,
    });

    // Update Mr. X player
    await ctx.db.patch(mrxPlayer._id, { isMrX: true, detectiveIndices: [] });

    // Update detective players with their assignments
    for (let i = 0; i < detectives.length; i++) {
      await ctx.db.patch(detectives[i]._id, {
        isMrX: false,
        detectiveIndices: detectiveAssignments[i],
      });
    }
  },
});

export const checkWin = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    return game?.winner;
  },
});

export const getRevealRounds = query({
  args: {},
  handler: async () => Array.from(REVEAL_ROUNDS),
});
