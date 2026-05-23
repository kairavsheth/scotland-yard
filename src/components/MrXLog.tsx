import { TRANSPORT_COLORS, TRANSPORT_LABELS } from "../data/board";

const LOG_TICKET_SRC: Record<string, string> = {
  taxi: "/taxi_ticket.svg",
  bus: "/bus_ticket.svg",
  underground: "/ug_ticket.svg",
  black: "/black_ticket.svg",
};

interface LogEntry {
  round: number;
  transport: string;
  position?: number;
}

interface Props {
  log: LogEntry[];
  showAll?: boolean; // if true, show position even when not a reveal round
}

const REVEAL_ROUNDS = new Set([3, 8, 13, 18]);

const TRANSPORT_ICONS: Record<string, string> = {
  taxi: "🟡",
  bus: "🟢",
  underground: "🔴",
  black: "🖤",
  water: "⛵",
  ferry: "⛵",
  caught: "🚨",
};

export default function MrXLog({ log, showAll = false }: Props) {
  if (log.length === 0) {
    return (
      <div className="mrx-log empty">
        <p>Mr. X has not moved yet.</p>
      </div>
    );
  }

  return (
    <div className="mrx-log">
      <table className="log-table">
        <thead>
          <tr>
            <th>Round</th>
            <th>Transport</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {log.map((entry, i) => {
            const isReveal = REVEAL_ROUNDS.has(entry.round);
            const showPos = showAll || isReveal || entry.transport === "caught";
            const icon = TRANSPORT_ICONS[entry.transport] ?? "?";
            const label = TRANSPORT_LABELS[entry.transport] ?? entry.transport;

            return (
              <tr key={i} className={isReveal ? "reveal-row" : ""}>
                <td>{entry.round}</td>
                <td>
                  {LOG_TICKET_SRC[entry.transport] ? (
                    <img
                      src={LOG_TICKET_SRC[entry.transport]}
                      className="log-ticket-img"
                      alt={label}
                      title={label}
                    />
                  ) : (
                    <span
                      className="transport-chip"
                      style={{
                        background:
                          TRANSPORT_COLORS[entry.transport as keyof typeof TRANSPORT_COLORS] ??
                          "#555",
                      }}
                    >
                      {icon} {label}
                    </span>
                  )}
                </td>
                <td className="position-cell">
                  {showPos && entry.position !== undefined ? (
                    <strong className="revealed">{entry.position}</strong>
                  ) : isReveal && entry.position !== undefined ? (
                    <strong className="revealed">{entry.position}</strong>
                  ) : (
                    <span className="hidden-pos">?</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
