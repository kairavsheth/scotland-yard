import { ConvexError } from "convex/values";

/** Extract a human-readable message from a Convex mutation error. */
export function extractError(e: unknown, fallback = "Something went wrong."): string {
  if (e instanceof ConvexError) {
    return typeof e.data === "string" ? e.data : fallback;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}
