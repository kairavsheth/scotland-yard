import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "../lib/session";
import type { GameInfo } from "../App";

interface Props {
  onJoined: (info: GameInfo) => void;
}

export default function Lobby({ onJoined }: Props) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createGame = useMutation(api.games.createGame);
  const joinGame = useMutation(api.games.joinGame);

  const sessionId = getSessionId();

  async function handleCreate() {
    if (!name.trim()) { setError("Enter your name"); return; }
    setLoading(true);
    setError("");
    try {
      const result = await createGame({ sessionId, playerName: name.trim() });
      onJoined({ gameId: result.gameId, code: result.code });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) { setError("Enter your name"); return; }
    if (!joinCode.trim()) { setError("Enter a room code"); return; }
    setLoading(true);
    setError("");
    try {
      const result = await joinGame({ sessionId, playerName: name.trim(), code: joinCode.trim() });
      onJoined({ gameId: result.gameId, code: result.code });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Room not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-header">
          <div className="logo">🔍</div>
          <h1>Scotland Yard</h1>
          <p className="subtitle">The classic hidden movement game · 2-6 players</p>
        </div>

        <div className="form-group">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            type="text"
            placeholder="Detective Smith…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="lobby-actions">
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? "Creating…" : "Create Room"}
          </button>

          <div className="divider">or</div>

          <div className="join-row">
            <input
              type="text"
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="code-input"
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <button className="btn btn-secondary" onClick={handleJoin} disabled={loading}>
              Join
            </button>
          </div>
        </div>

        <div className="rules-summary">
          <h3>Quick Rules</h3>
          <ul>
            <li>🕵️ One player is <strong>Mr. X</strong>, the rest are detectives</li>
            <li>🚕 Move by taxi, bus, or underground each round</li>
            <li>🎭 Mr. X&apos;s position is revealed at rounds 3, 8, 13 &amp; 18</li>
            <li>🖤 Mr. X has <strong>4 black tickets</strong> (wildcard) &amp; <strong>2 double-moves</strong></li>
            <li>✅ Detectives win by landing on Mr. X · Mr. X wins after 22 rounds</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
