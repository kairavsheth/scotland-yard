import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    code: v.string(),
    status: v.union(
      v.literal("lobby"),
      v.literal("playing"),
      v.literal("finished"),
    ),
    round: v.number(), // 1-22
    phase: v.union(v.literal("mrx"), v.literal("detectives")),
    currentDetectiveIdx: v.number(), // 0-4
    doubleMovePending: v.boolean(), // Mr. X used double-move, second move pending
    winner: v.optional(v.union(v.literal("mrx"), v.literal("detectives"))),
    mrxPosition: v.number(), // SECRET – only returned to Mr. X session
    // Mr. X travel log – shown to all detectives (transport visible, position only at reveal rounds)
    mrxLog: v.array(
      v.object({
        round: v.number(),
        transport: v.string(), // 'taxi' | 'bus' | 'underground' | 'black' | 'ferry'
        position: v.optional(v.number()), // revealed at rounds 3, 8, 13, 18
      }),
    ),
    // 5 detectives stored inline
    detectives: v.array(
      v.object({
        position: v.number(),
        taxi: v.number(),
        bus: v.number(),
        underground: v.number(),
      }),
    ),
    mrxBlackTickets: v.number(),
    mrxDoubleMoveTickets: v.number(),
  }).index("by_code", ["code"]),

  players: defineTable({
    gameId: v.id("games"),
    sessionId: v.string(),
    name: v.string(),
    isMrX: v.boolean(),
    // Which of the 5 detectives (indices 0-4) this player controls
    detectiveIndices: v.array(v.number()),
    isHost: v.boolean(),
  })
    .index("by_game", ["gameId"])
    .index("by_session_game", ["sessionId", "gameId"]),
});
