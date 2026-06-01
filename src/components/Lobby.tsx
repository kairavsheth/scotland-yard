import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "../lib/session";
import { getPlayerName } from "../lib/playerName";
import type { GameInfo } from "../App";

interface Props {
  onJoined: (info: GameInfo) => void;
  initialCode?: string;
}

function friendlyJoinError(err: string, code: string): string {
  const e = err.toLowerCase();
  if (e.includes("not found")) return `No room with code "${code}" was found.`;
  if (e.includes("already started")) return "That game has already started — ask the host to create a new room.";
  if (e.includes("full")) return "This room is full (max 6 players).";
  return err;
}

export default function Lobby({ onJoined, initialCode = "" }: Props) {
  const [joinCode, setJoinCode] = useState(initialCode);
  const [joinError, setJoinError] = useState("");
  const [createError, setCreateError] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);

  const createGame = useMutation(api.games.createGame);
  const joinGame = useMutation(api.games.joinGame);

  const sessionId = getSessionId();
  const playerName = getPlayerName() ?? "Player";

  async function handleCreate() {
    setLoading("create");
    setCreateError("");
    try {
      const result = await createGame({ sessionId, playerName });
      onJoined({ gameId: result.gameId, code: result.code });
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError("Enter a room code to join.");
      return;
    }
    setLoading("join");
    setJoinError("");
    try {
      const result = await joinGame({ sessionId, playerName, code });
      onJoined({ gameId: result.gameId, code: result.code });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to join";
      setJoinError(friendlyJoinError(msg, code));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-card">

        {/* Header */}
        <div className="lobby-header">
          <img src="/favicon.png" alt="Scotland Yard" className="lobby-logo-img" />
          <h1>Scotland Yard</h1>
          <p className="subtitle">The hidden movement deduction game · 2–6 players</p>
        </div>

        {/* Playing as */}
        <div className="lobby-playing-as">
          Playing as <strong>{playerName}</strong>
        </div>

        {/* Create */}
        {createError && (
          <div className="alert-error">
            <span className="alert-icon">⚠</span>{createError}
          </div>
        )}
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={handleCreate}
          disabled={loading !== null}
        >
          {loading === "create" ? "Creating…" : "Create New Game"}
        </button>

        {/* Join */}
        <div className="lobby-divider">or join an existing game</div>

        <div className="join-group">
          <div className="join-row">
            <input
              type="text"
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(""); }}
              maxLength={6}
              className={`code-input${joinError ? " code-input-error" : ""}`}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              autoFocus={!!initialCode}
            />
            <button
              className="btn btn-secondary"
              onClick={handleJoin}
              disabled={loading !== null}
            >
              {loading === "join" ? "Joining…" : "Join"}
            </button>
          </div>
          {joinError && (
            <div className="field-error-box">
              <span className="alert-icon">⚠</span>{joinError}
            </div>
          )}
        </div>

        {/* Rules */}
        <details className="rules-summary">
          <summary>Quick Rules</summary>
          <ul>
            <li>🕵️ One player is <strong>Mr. X</strong>, the rest are detectives</li>
            <li>🚕 Move by taxi, bus, or underground each round</li>
            <li>🎭 Mr. X's position is revealed at rounds 3, 8, 13 &amp; 18</li>
            <li>🖤 Mr. X has <strong>4 black tickets</strong> &amp; <strong>2 double-moves</strong></li>
            <li>✅ Detectives win by landing on Mr. X · Mr. X wins after 22 rounds</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
