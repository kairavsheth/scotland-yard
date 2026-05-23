const TICKET_SRCS: Record<string, string> = {
  taxi: "/taxi_ticket.svg",
  bus: "/bus_ticket.svg",
  underground: "/ug_ticket.svg",
  black: "/black_ticket.svg",
  "2x": "/2x_ticket.svg",
};

interface Props {
  type: string;
  count?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}

export default function TicketCard({
  type,
  count,
  selected = false,
  disabled = false,
  onClick,
  size = "md",
}: Props) {
  const src = TICKET_SRCS[type];
  if (!src) return null;

  const sizeClass = size === "sm" ? "ticket-sm" : "ticket-md";
  const selectedClass = selected ? "ticket-selected" : "";
  const disabledClass = disabled ? "ticket-disabled" : "";
  const className = ["ticket-card", sizeClass, selectedClass, disabledClass]
    .filter(Boolean)
    .join(" ");

  const img = <img src={src} alt={type} draggable={false} />;
  const badge =
    count !== undefined ? (
      <span className="ticket-count">×{count}</span>
    ) : null;

  if (onClick) {
    return (
      <button
        className={className}
        onClick={onClick}
        disabled={disabled}
        type="button"
      >
        {img}
        {badge}
      </button>
    );
  }

  return (
    <div className={className}>
      {img}
      {badge}
    </div>
  );
}
