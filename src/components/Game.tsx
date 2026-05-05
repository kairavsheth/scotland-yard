import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getSessionId } from "../lib/session";
import { getAllReachable, TRANSPORT_LABELS } from "../data/board";
import type { Transport } from "../data/board";
import GameBoard from "./GameBoard";
import MrXLog from "./MrXLog";
import PlayerPanel from "./PlayerPanel";

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

  const [selectedMrXTarget, setSelectedMrXTarget] = useState<number | null>(null);
  const [selectedTransport, setSelectedTransport] = useState<string>("");
  const [useDoubleMove, setUseDoubleMove] = useState(false);
  const [mrxAssign, setMrxAssign] = useState<string>("");
  const [actionError, setActionError] = useState("");

  if (!gameState) {
    return <div className="loading">Loading…</div>;
  }

  const {
    status, round, phase, currentDetectiveIdx, doubleMovePending,
    winner, mrxPosition, mrxLog, detectives, mrxBlackTickets,
    mrxDoubleMoveTickets, players, me,
  } = gameState;

  const isMrX = me?.isMrX ?? false;
  const isHost = me?.isHost ?? false;
  const myDetectives = me?.detectiveIndices ?? [];
  const isMyDetectiveTurn =
    phase === "detectives" && myDetectives.includes(currentDetectiveIdx);

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
    return (
      <div className="finished-screen">
        <div className="finished-card">
          <div className="winner-icon">{winner === "mrx" ? "🎭" : "🕵️"}</div>
          <h1>{winner === "mrx" ? "Mr. X Escaped!" : "Detectives Win!"}</h1>
          <p>
            {winner === "mrx"
              ? "Mr. X successfully evaded capture for 22 rounds."
              : "Mr. X was caught!"}
          </p>
          <p className="mrx-reveal">Mr. X was at station <strong>{mrxPosition}</strong></p>
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

  async function handleDetMove(stationId: number, transport: string) {
    if (myDetIndex === null) return;
    setActionError("");
    try {
      await moveDetective({ gameId, sessionId, detectiveIdx: myDetIndex, targetStation: stationId, transport });
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
    for (const [t, stations] of detReachable) {
      stations.forEach((s: number) => moveHighlights.push({ station: s, transport: t }));
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
        />

        <button className="btn btn-ghost btn-sm" onClick={onLeave}>Leave</button>
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
          onStationClick={(stationId, transport) => {
            if (isMrXTurn) {
              setSelectedMrXTarget(stationId);
              if (transport) setSelectedTransport(transport);
            } else if (isMyDetectiveTurn && transport) {
              handleDetMove(stationId, transport);
            }
          }}
          selectedStation={isMrXTurn ? selectedMrXTarget : null}
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
                <strong>{myDet?.position}</strong> — click a highlighted station to move
              </p>
              <div className="ticket-display">
                <span>🟡 Taxi: {myDet?.taxi}</span>
                <span>🟢 Bus: {myDet?.bus}</span>
                <span>🔴 Underground: {myDet?.underground}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleSkip}>
                Skip (trapped)
              </button>
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
