import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getSessionId } from "../lib/session";
import { getAllReachable, TRANSPORT_LABELS } from "../data/board";
import type { Transport } from "../data/board";
import GameBoard from "./GameBoard";
import MrXLog from "./MrXLog";
import PlayerPanel from "./PlayerPanel";

const HEARTBEAT_MS = 8_000;
const DISCONNECTED_MS = 16_000; // lastSeen older than this → "reconnecting"

interface Props {
  gameId: Id<"games">;
  code: string;
  onLeave: () => void;
}

export default function Game({ gameId, code, onLeave }: Props) {
  const sessionId = getSessionId();
  const gameState = useQuery(api.games.getGameState, { gameId, sessionId });

  const startGame = useMutation(api.games.startGame);
  const moveMrX = useMutation(api.moves.moveMrX);
  const moveDetective = useMutation(api.moves.moveDetective);
  const skipDetective = useMutation(api.moves.skipDetective);
  const endGameMutation = useMutation(api.games.endGame);
  const heartbeatMutation = useMutation(api.games.heartbeat);

  const [selectedMrXTarget, setSelectedMrXTarget] = useState<number | null>(null);
  const [selectedTransport, setSelectedTransport] = useState<string>("");
  const [useDoubleMove, setUseDoubleMove] = useState(false);
  const [selectedDetTarget, setSelectedDetTarget] = useState<number | null>(null);
  const [selectedDetTransport, setSelectedDetTransport] = useState<string>("");
  const [mrxAssign, setMrxAssign] = useState<string>("");
  const [actionError, setActionError] = useState("");
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // ─── Heartbeat ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState || gameState.status !== "playing") return;
    heartbeatMutation({ gameId, sessionId }).catch(() => {});
    const id = setInterval(() => {
      heartbeatMutation({ gameId, sessionId }).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [gameId, sessionId, gameState?.status]);

  if (!gameState) {
    return <div className="loading">Loading…</div>;
  }

  // Player not found in game (session expired / wrong link)
  if (!gameState.me) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <div className="lobby-header">
            <div className="logo">🔍</div>
            <h1>Session not found</h1>
            <p className="subtitle">This session is no longer active.</p>
          </div>
          <button className="btn btn-primary" onClick={onLeave}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  const {
    status, round, phase, currentDetectiveIdx, doubleMovePending,
    winner, mrxPosition, mrxLog, detectives, mrxBlackTickets,
    mrxDoubleMoveTickets, players, me,
  } = gameState;

  const now = Date.now();
  const isMrX = me.isMrX;
  const isHost = me.isHost;
  const myDetectives = me.detectiveIndices;
  const isMyDetectiveTurn = phase === "detectives" && myDetectives.includes(currentDetectiveIdx);

  async function handleEndGame() {
    try {
      await endGameMutation({ gameId, sessionId });
      onLeave();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to end game");
    }
  }

  // ─── Lobby ───────────────────────────────────────────────────────────────────

  if (status === "lobby") {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <div className="lobby-header">
            <div className="logo">🔍</div>
            <h1>Room: <span className="room-code">{code}</span></h1>
            <p className="subtitle">Share this code with your friends</p>
          </div>

          <div className="player-list">
            <h3>Players ({players?.length ?? 0} / 6)</h3>
            {players?.map((p) => (
              <div key={p._id} className={`player-row ${p.sessionId === sessionId ? "me" : ""}`}>
                <span className="player-name">{p.name}</span>
                {p.isHost && <span className="badge host">Host</span>}
              </div>
            ))}
          </div>

          {isHost && (players?.length ?? 0) >= 2 && (
            <div className="start-section">
              <div className="form-group">
                <label>Who is Mr. X?</label>
                <select value={mrxAssign} onChange={(e) => setMrxAssign(e.target.value)}>
                  <option value="">— Pick a player —</option>
                  {players?.map((p) => (
                    <option key={p._id} value={p.sessionId}>{p.name}</option>
                  ))}
                </select>
              </div>
              {actionError && <p className="error">{actionError}</p>}
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!mrxAssign) { setActionError("Select Mr. X first"); return; }
                  setActionError("");
                  try {
                    await startGame({ gameId, sessionId, mrxSessionId: mrxAssign });
                  } catch (e: unknown) {
                    setActionError(e instanceof Error ? e.message : "Error starting game");
                  }
                }}
              >
                Start Game
              </button>
            </div>
          )}

          {isHost && (players?.length ?? 0) < 2 && (
            <p className="hint">Waiting for at least 1 more player…</p>
          )}
          {!isHost && <p className="hint">Waiting for host to start the game…</p>}

          <button className="btn btn-ghost" onClick={onLeave}>Leave Room</button>
        </div>
      </div>
    );
  }

  // ─── Finished ────────────────────────────────────────────────────────────────

  if (status === "finished") {
    const wasAbandoned = !winner;
    return (
      <div className="finished-screen">
        <div className="finished-card">
          <div className="winner-icon">
            {wasAbandoned ? "🏳️" : winner === "mrx" ? "🎭" : "🕵️"}
          </div>
          <h1>
            {wasAbandoned
              ? "Game Ended"
              : winner === "mrx"
              ? "Mr. X Escaped!"
              : "Detectives Win!"}
          </h1>
          <p>
            {wasAbandoned
              ? "The game was ended by a player."
              : winner === "mrx"
              ? "Mr. X successfully evaded capture for 22 rounds."
              : "Mr. X was caught!"}
          </p>
          {mrxPosition && (
            <p className="mrx-reveal">Mr. X was at station <strong>{mrxPosition}</strong></p>
          )}
          <MrXLog log={mrxLog ?? []} showAll />
          <button className="btn btn-primary" onClick={onLeave}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  // ─── Playing ─────────────────────────────────────────────────────────────────

  const mrxReachable = mrxPosition ? getAllReachable(mrxPosition, true) : new Map<Transport, number[]>();
  const myDetIndex = isMyDetectiveTurn ? currentDetectiveIdx : null;
  const myDet = myDetIndex !== null ? detectives?.[myDetIndex] : null;
  const detReachable = myDet ? getAllReachable(myDet.position, false) : new Map<Transport, number[]>();
  const isMrXTurn = phase === "mrx" && isMrX;

  async function handleMrXMove() {
    if (!selectedMrXTarget || !selectedTransport) {
      setActionError("Pick a station and transport type");
      return;
    }
    setActionError("");
    try {
      await moveMrX({ gameId, sessionId, targetStation: selectedMrXTarget, transport: selectedTransport, useDoubleMove });
      setSelectedMrXTarget(null);
      setSelectedTransport("");
      setUseDoubleMove(false);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Move failed");
    }
  }

  async function handleDetMove() {
    if (myDetIndex === null || !selectedDetTarget || !selectedDetTransport) {
      setActionError("Pick a station and transport type");
      return;
    }
    setActionError("");
    try {
      await moveDetective({ gameId, sessionId, detectiveIdx: myDetIndex, targetStation: selectedDetTarget, transport: selectedDetTransport });
      setSelectedDetTarget(null);
      setSelectedDetTransport("");
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Move failed");
    }
  }

  async function handleSkip() {
    if (myDetIndex === null) return;
    try {
      await skipDetective({ gameId, sessionId, detectiveIdx: myDetIndex });
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Skip failed");
    }
  }

  // Move highlights
  const moveHighlights: { station: number; transport: string }[] = [];
  if (isMrXTurn && mrxPosition) {
    for (const [t, stations] of mrxReachable) {
      stations.forEach((s: number) => moveHighlights.push({ station: s, transport: t }));
    }
    if ((mrxBlackTickets ?? 0) > 0) {
      for (const [, stations] of mrxReachable) {
        stations.forEach((s: number) => {
          if (!moveHighlights.find((m) => m.station === s && m.transport === "black")) {
            moveHighlights.push({ station: s, transport: "black" });
          }
        });
      }
    }
  }
  if (isMyDetectiveTurn && myDet) {
    const occupiedByDetective = new Set((detectives ?? []).map((d) => d.position));
    for (const [t, stations] of detReachable) {
      stations.forEach((s: number) => {
        if (!occupiedByDetective.has(s)) moveHighlights.push({ station: s, transport: t });
      });
    }
  }

  const turnLabel = () => {
    if (phase === "mrx") {
      return doubleMovePending ? "Mr. X – Second Move (Double)" : "Mr. X's turn";
    }
    const name = players?.find((p) => p.detectiveIndices.includes(currentDetectiveIdx))?.name;
    return `Detective ${currentDetectiveIdx + 1}${name ? ` (${name})` : ""}'s turn`;
  };

  return (
    <div className="game-layout">
      {/* Left sidebar */}
      <aside className="sidebar left-sidebar">
        <div className="sidebar-header">
          <span className="room-code-small">{code}</span>
          <span className="round-badge">Round {round} / 22</span>
        </div>

        <PlayerPanel
          players={players ?? []}
          detectives={detectives ?? []}
          mrxPosition={isMrX ? mrxPosition : undefined}
          currentDetectiveIdx={currentDetectiveIdx}
          phase={phase}
          sessionId={sessionId}
          now={now}
          disconnectedMs={DISCONNECTED_MS}
        />

        {/* End game button with confirmation */}
        {showEndConfirm ? (
          <div className="end-confirm">
            <p>End the game for everyone?</p>
            <div className="end-confirm-actions">
              <button className="btn btn-danger" onClick={handleEndGame}>Yes, End Game</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEndConfirm(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost btn-sm end-game-btn" onClick={() => setShowEndConfirm(true)}>
            End Game
          </button>
        )}
      </aside>

      {/* Main board */}
      <main className="board-area">
        <div className="turn-banner">
          <span className={`turn-label ${phase === "mrx" ? "mrx-turn" : "det-turn"}`}>
            {turnLabel()}
          </span>
          {actionError && <span className="turn-error">{actionError}</span>}
        </div>

        <GameBoard
          detectives={detectives ?? []}
          mrxPosition={isMrX ? mrxPosition : undefined}
          moveHighlights={moveHighlights}
          onStationClick={(stationId) => {
            if (isMrXTurn) {
              setSelectedMrXTarget(stationId);
              setSelectedTransport("");
            } else if (isMyDetectiveTurn) {
              setSelectedDetTarget(stationId);
              setSelectedDetTransport("");
            }
          }}
          selectedStation={isMrXTurn ? selectedMrXTarget : isMyDetectiveTurn ? selectedDetTarget : null}
        />

        {/* Mr. X move controls */}
        {isMrXTurn && (
          <div className="move-controls">
            <div className="move-controls-inner">
              {selectedMrXTarget !== null && (
                <div className="transport-selector">
                  <span>Move to <strong>{selectedMrXTarget}</strong> via:</span>
                  {(["taxi", "bus", "underground", "black"] as const).map((t) => {
                    const reachable =
                      t === "black"
                        ? ((mrxBlackTickets ?? 0) > 0 && [...mrxReachable.values()].flat().includes(selectedMrXTarget))
                        : mrxReachable.get(t as Transport)?.includes(selectedMrXTarget) ?? false;
                    if (!reachable) return null;
                    return (
                      <button
                        key={t}
                        className={`btn transport-btn ${t} ${selectedTransport === t ? "selected" : ""}`}
                        onClick={() => setSelectedTransport(t)}
                      >
                        {TRANSPORT_LABELS[t]}
                        {t === "black" && ` (${mrxBlackTickets})`}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="move-actions">
                {(mrxDoubleMoveTickets ?? 0) > 0 && !doubleMovePending && (
                  <label className="double-move-toggle">
                    <input
                      type="checkbox"
                      checked={useDoubleMove}
                      onChange={(e) => setUseDoubleMove(e.target.checked)}
                    />
                    Use Double Move ({mrxDoubleMoveTickets} left)
                  </label>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleMrXMove}
                  disabled={!selectedMrXTarget || !selectedTransport}
                >
                  Confirm Move
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detective turn */}
        {isMyDetectiveTurn && (
          <div className="move-controls">
            <div className="move-controls-inner">
              <p>
                Detective {currentDetectiveIdx + 1} at station{" "}
                <strong>{myDet?.position}</strong>
                {selectedDetTarget === null && " — click a highlighted station"}
              </p>

              {selectedDetTarget !== null && (
                <div className="transport-selector">
                  <span>Move to <strong>{selectedDetTarget}</strong> via:</span>
                  {(["taxi", "bus", "underground"] as const).map((t) => {
                    const reachable = detReachable.get(t)?.includes(selectedDetTarget) ?? false;
                    const hasTicket = t === "taxi" ? (myDet?.taxi ?? 0) > 0
                      : t === "bus" ? (myDet?.bus ?? 0) > 0
                      : (myDet?.underground ?? 0) > 0;
                    if (!reachable || !hasTicket) return null;
                    return (
                      <button
                        key={t}
                        className={`btn transport-btn ${t} ${selectedDetTransport === t ? "selected" : ""}`}
                        onClick={() => setSelectedDetTransport(t)}
                      >
                        {TRANSPORT_LABELS[t]}
                      </button>
                    );
                  })}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setSelectedDetTarget(null); setSelectedDetTransport(""); }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="move-actions">
                <div className="ticket-display">
                  <span>🟡 {myDet?.taxi}</span>
                  <span>🟢 {myDet?.bus}</span>
                  <span>🔴 {myDet?.underground}</span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleDetMove}
                  disabled={!selectedDetTarget || !selectedDetTransport}
                >
                  Confirm Move
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleSkip}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Waiting */}
        {!isMrXTurn && !isMyDetectiveTurn && (
          <div className="move-controls waiting">
            <p>Waiting for {turnLabel()}…</p>
          </div>
        )}
      </main>

      {/* Right sidebar */}
      <aside className="sidebar right-sidebar">
        <h3>Mr. X Travel Log</h3>
        <MrXLog log={mrxLog ?? []} showAll={isMrX} />
        {isMrX && mrxPosition && (
          <div className="mrx-secret">
            <span>Your position: <strong>{mrxPosition}</strong></span>
            <div className="ticket-display">
              <span>🖤 Black: {mrxBlackTickets}</span>
              <span>⚡ Double: {mrxDoubleMoveTickets}</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
