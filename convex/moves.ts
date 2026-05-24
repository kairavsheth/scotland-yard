import { mutation } from "./_generated/server";
import { v } from "convex/values";

const REVEAL_ROUNDS = new Set([3, 8, 13, 18]);
const MAX_ROUNDS = 22;

// ─── Mr. X move ──────────────────────────────────────────────────────────────

export const moveMrX = mutation({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
    targetStation: v.number(),
    transport: v.string(), // 'taxi' | 'bus' | 'underground' | 'black' | 'ferry'
    useDoubleMove: v.boolean(),
  },
  handler: async (ctx, { gameId, sessionId, targetStation, transport, useDoubleMove }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "playing") throw new Error("Game not active");
    if (game.phase !== "mrx") throw new Error("Not Mr. X's turn");

    const player = await ctx.db
      .query("players")
      .withIndex("by_session_game", (q) =>
        q.eq("sessionId", sessionId).eq("gameId", gameId),
      )
      .first();
    if (!player?.isMrX) throw new Error("You are not Mr. X");

    // Validate double move usage
    if (useDoubleMove && !game.doubleMovePending) {
      if (game.mrxDoubleMoveTickets < 1) throw new Error("No double-move tickets");
    }

    // Consume ticket
    let { mrxBlackTickets, mrxDoubleMoveTickets } = game;
    if (transport === "black" || transport === "ferry") {
      if (mrxBlackTickets < 1) throw new Error("No black tickets");
      mrxBlackTickets--;
    }

    const isReveal = REVEAL_ROUNDS.has(game.round);
    const logEntry = {
      round: game.round,
      transport,
      position: isReveal ? targetStation : undefined,
    };

    const newLog = [...game.mrxLog, logEntry];
    let newDoubleMovePending: boolean;
    let nextPhase: "mrx" | "detectives";

    if (useDoubleMove && !game.doubleMovePending) {
      // First move of a double move
      mrxDoubleMoveTickets--;
      newDoubleMovePending = true;
      nextPhase = "mrx"; // Mr. X moves again
    } else {
      newDoubleMovePending = false;
      nextPhase = "detectives";
    }

    // Check if any detective is on the target station (Mr. X moving into detective = caught)
    const caught = game.detectives.some((d) => d.position === targetStation);
    if (caught) {
      await ctx.db.patch(gameId, {
        mrxPosition: targetStation,
        mrxLog: newLog,
        mrxBlackTickets,
        mrxDoubleMoveTickets,
        winner: "detectives",
        status: "finished",
      });
      return;
    }

    await ctx.db.patch(gameId, {
      mrxPosition: targetStation,
      mrxLog: newLog,
      mrxBlackTickets,
      mrxDoubleMoveTickets,
      doubleMovePending: newDoubleMovePending,
      phase: nextPhase,
      currentDetectiveIdx: 0,
    });
  },
});

// ─── Detective move ───────────────────────────────────────────────────────────

export const moveDetective = mutation({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
    detectiveIdx: v.number(), // 0-4
    targetStation: v.number(),
    transport: v.string(), // 'taxi' | 'bus' | 'underground'
  },
  handler: async (ctx, { gameId, sessionId, detectiveIdx, targetStation, transport }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "playing") throw new Error("Game not active");
    if (game.phase !== "detectives") throw new Error("Not detectives' turn");
    if (game.currentDetectiveIdx !== detectiveIdx) {
      throw new Error(`It's detective ${game.currentDetectiveIdx + 1}'s turn`);
    }

    const player = await ctx.db
      .query("players")
      .withIndex("by_session_game", (q) =>
        q.eq("sessionId", sessionId).eq("gameId", gameId),
      )
      .first();
    if (!player) throw new Error("Player not found");
    if (!player.detectiveIndices.includes(detectiveIdx)) {
      throw new Error("You don't control this detective");
    }

    const det = game.detectives[detectiveIdx];
    if (!det) throw new Error("Detective not found");

    // Validate ticket availability
    if (transport === "taxi" && det.taxi < 1) throw new Error("No taxi tickets");
    if (transport === "bus" && det.bus < 1) throw new Error("No bus tickets");
    if (transport === "underground" && det.underground < 1) throw new Error("No underground tickets");

    // Check another detective isn't already there
    const blocked = game.detectives.some(
      (d, i) => i !== detectiveIdx && d.position === targetStation,
    );
    if (blocked) throw new Error("Another detective is already there");

    // Update detective position and tickets
    const newDetectives = game.detectives.map((d, i) => {
      if (i !== detectiveIdx) return d;
      return {
        ...d,
        position: targetStation,
        taxi: transport === "taxi" ? d.taxi - 1 : d.taxi,
        bus: transport === "bus" ? d.bus - 1 : d.bus,
        underground: transport === "underground" ? d.underground - 1 : d.underground,
      };
    });

    // Check if detective caught Mr. X
    if (targetStation === game.mrxPosition) {
      await ctx.db.patch(gameId, {
        detectives: newDetectives,
        winner: "detectives",
        status: "finished",
        mrxLog: [
          ...game.mrxLog,
          { round: game.round, transport: "caught", position: targetStation },
        ],
      });
      return;
    }

    // Advance turn: next detective, or back to Mr. X for next round
    const nextDetectiveIdx = detectiveIdx + 1;

    if (nextDetectiveIdx >= 5) {
      // All detectives moved – advance round
      const newRound = game.round + 1;

      if (newRound > MAX_ROUNDS) {
        // Mr. X wins by surviving
        await ctx.db.patch(gameId, {
          detectives: newDetectives,
          round: newRound,
          winner: "mrx",
          status: "finished",
        });
        return;
      }

      // Check if all detectives are trapped (no moves available – handled client-side for now)
      await ctx.db.patch(gameId, {
        detectives: newDetectives,
        round: newRound,
        phase: "mrx",
        currentDetectiveIdx: 0,
      });
    } else {
      await ctx.db.patch(gameId, {
        detectives: newDetectives,
        currentDetectiveIdx: nextDetectiveIdx,
      });
    }
  },
});

// ─── Skip detective (when trapped with no moves) ─────────────────────────────

export const skipDetective = mutation({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
    detectiveIdx: v.number(),
  },
  handler: async (ctx, { gameId, sessionId, detectiveIdx }) => {
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "playing") throw new Error("Game not active");
    if (game.phase !== "detectives") throw new Error("Not detectives' turn");
    if (game.currentDetectiveIdx !== detectiveIdx) throw new Error("Not this detective's turn");

    const player = await ctx.db
      .query("players")
      .withIndex("by_session_game", (q) =>
        q.eq("sessionId", sessionId).eq("gameId", gameId),
      )
      .first();
    if (!player?.detectiveIndices.includes(detectiveIdx)) throw new Error("Not your detective");

    const nextDetectiveIdx = detectiveIdx + 1;
    if (nextDetectiveIdx >= 5) {
      const newRound = game.round + 1;
      if (newRound > MAX_ROUNDS) {
        await ctx.db.patch(gameId, { round: newRound, winner: "mrx", status: "finished" });
        return;
      }
      await ctx.db.patch(gameId, { round: newRound, phase: "mrx", currentDetectiveIdx: 0 });
    } else {
      await ctx.db.patch(gameId, { currentDetectiveIdx: nextDetectiveIdx });
    }
  },
});
