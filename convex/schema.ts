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
    round: v.number(),
    phase: v.union(v.literal("mrx"), v.literal("detectives")),
    currentDetectiveIdx: v.number(),
    doubleMovePending: v.boolean(),
    winner: v.optional(v.union(v.literal("mrx"), v.literal("detectives"))),
    mrxPosition: v.number(),
    mrxLog: v.array(
      v.object({
        round: v.number(),
        transport: v.string(),
        position: v.optional(v.number()),
      }),
    ),
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
    detectiveIndices: v.array(v.number()),
    isHost: v.boolean(),
    lastSeen: v.optional(v.number()), // ms timestamp for connection tracking
  })
    .index("by_game", ["gameId"])
    .index("by_session_game", ["sessionId", "gameId"])
    .index("by_session", ["sessionId"]),
});
