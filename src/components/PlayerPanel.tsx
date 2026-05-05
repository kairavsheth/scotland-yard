import { DETECTIVE_COLORS } from "../data/board";

interface DetectiveState {
  position: number;
  taxi: number;
  bus: number;
  underground: number;
}

interface Player {
  _id: string;
  sessionId: string;
  name: string;
  isMrX: boolean;
  detectiveIndices: number[];
  isHost: boolean;
}

interface Props {
  players: Player[];
  detectives: DetectiveState[];
  mrxPosition?: number;
  currentDetectiveIdx: number;
  phase: string;
  sessionId: string;
}

export default function PlayerPanel({
  players,
  detectives,
  mrxPosition,
  currentDetectiveIdx,
  phase,
  sessionId,
}: Props) {
  const mrxPlayer = players.find((p) => p.isMrX);

  return (
    <div className="player-panel">
      {/* Mr. X */}
      <div className={`panel-player mrx-player ${phase === "mrx" ? "active-turn" : ""}`}>
        <div className="panel-player-header">
          <span className="mrx-icon">🎭</span>
          <span className="player-name">{mrxPlayer?.name ?? "Mr. X"}</span>
          {mrxPlayer?.sessionId === sessionId && <span className="badge you">You</span>}
          {phase === "mrx" && <span className="badge turn">Moving</span>}
        </div>
        {mrxPosition !== undefined && (
          <div className="player-position">Station {mrxPosition}</div>
        )}
      </div>

      {/* Detectives */}
      <div className="detectives-section">
        <h4>Detectives</h4>
        {detectives.map((det, idx) => {
          const controller = players.find((p) => p.detectiveIndices.includes(idx));
          const isMyTurn = phase === "detectives" && currentDetectiveIdx === idx;
          const isMe = controller?.sessionId === sessionId;

          return (
            <div
              key={idx}
              className={`panel-detective ${isMyTurn ? "active-turn" : ""}`}
            >
              <div className="detective-header">
                <span
                  className="detective-dot"
                  style={{ background: DETECTIVE_COLORS[idx] }}
                />
                <span className="detective-label">Det. {idx + 1}</span>
                {controller && (
                  <span className="controller-name">
                    {controller.name}
                    {isMe && <span className="badge you">You</span>}
                  </span>
                )}
                {isMyTurn && <span className="badge turn">Moving</span>}
              </div>
              <div className="detective-info">
                <span className="det-pos">Stn {det.position}</span>
                <span className="tickets">
                  🟡{det.taxi} 🟢{det.bus} 🔴{det.underground}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Turn order summary */}
      <div className="turn-order">
        <h4>Turn Order</h4>
        <div className="turn-sequence">
          <span className={`turn-step ${phase === "mrx" ? "current" : "done"}`}>
            🎭 Mr. X
          </span>
          {detectives.map((_, idx) => (
            <span
              key={idx}
              className={`turn-step ${
                phase === "detectives" && currentDetectiveIdx === idx
                  ? "current"
                  : phase === "detectives" && idx < currentDetectiveIdx
                  ? "done"
                  : ""
              }`}
              style={{ borderColor: DETECTIVE_COLORS[idx] }}
            >
              D{idx + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
