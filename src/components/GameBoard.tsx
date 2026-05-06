import { useMemo, useState } from "react";
import { BOARD, BOARD_WIDTH, BOARD_HEIGHT, TRANSPORT_COLORS, DETECTIVE_COLORS } from "../data/board";
import type { Transport } from "../data/board";

interface DetectiveState {
  position: number;
  taxi: number;
  bus: number;
  underground: number;
}

interface MoveHighlight {
  station: number;
  transport: string;
}

interface Props {
  detectives: DetectiveState[];
  mrxPosition?: number;
  moveHighlights: MoveHighlight[];
  onStationClick: (stationId: number) => void;
  selectedStation: number | null;
}

const PAD = 18;
const VB = `${-PAD} ${-PAD} ${BOARD_WIDTH + PAD * 2} ${BOARD_HEIGHT + PAD * 2}`;

// Pre-build edge list for rendering (deduplicated)
const EDGES_TO_DRAW = (() => {
  const seen = new Set<string>();
  const result: { a: number; b: number; t: Transport }[] = [];
  for (const [id, station] of BOARD) {
    for (const t of ["taxi", "bus", "underground", "water"] as Transport[]) {
      for (const nb of station[t]) {
        const key = [Math.min(id, nb), Math.max(id, nb), t].join("-");
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ a: id, b: nb, t });
        }
      }
    }
  }
  return result;
})();

export default function GameBoard({
  detectives,
  mrxPosition,
  moveHighlights,
  onStationClick,
  selectedStation,
}: Props) {
  const [viewBox, setViewBox] = useState(VB);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vx: 0, vy: 0, vw: 0, vh: 0 });

  // Build highlight map: stationId -> best transport to show
  const highlightMap = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const h of moveHighlights) {
      if (!m.has(h.station)) m.set(h.station, []);
      m.get(h.station)!.push(h.transport);
    }
    return m;
  }, [moveHighlights]);

  // Detective positions map: stationId -> [detective indices]
  const detMap = useMemo(() => {
    const m = new Map<number, number[]>();
    detectives.forEach((d, i) => {
      if (!m.has(d.position)) m.set(d.position, []);
      m.get(d.position)!.push(i);
    });
    return m;
  }, [detectives]);

  // Pan handlers
  function parseVB(vb: string) {
    const [x, y, w, h] = vb.split(" ").map(Number);
    return { x, y, w, h };
  }

  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if ((e.target as SVGElement).closest(".station")) return; // don't pan on station clicks
    const { x, y, w, h } = parseVB(viewBox);
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY, vx: x, vy: y, vw: w, vh: h });
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isPanning) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - panStart.x) / rect.width) * panStart.vw;
    const dy = ((e.clientY - panStart.y) / rect.height) * panStart.vh;
    setViewBox(`${panStart.vx - dx} ${panStart.vy - dy} ${panStart.vw} ${panStart.vh}`);
  }

  function onMouseUp() { setIsPanning(false); }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const { x, y, w, h } = parseVB(viewBox);
    const factor = e.deltaY > 0 ? 1.12 : 0.88;
    const newW = Math.min(Math.max(w * factor, 200), BOARD_WIDTH * 3);
    const newH = Math.min(Math.max(h * factor, 150), BOARD_HEIGHT * 3);
    // Zoom toward center
    const cx = x + w / 2;
    const cy = y + h / 2;
    setViewBox(`${cx - newW / 2} ${cy - newH / 2} ${newW} ${newH}`);
  }

  return (
    <div className="board-container">
      <svg
        className="game-svg"
        viewBox={viewBox}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        {/* Background */}
        <rect
          x={-PAD} y={-PAD}
          width={BOARD_WIDTH + PAD * 2}
          height={BOARD_HEIGHT + PAD * 2}
          fill="#1a1a2e"
        />

        {/* Edges */}
        {EDGES_TO_DRAW.map(({ a, b, t }) => {
          const sa = BOARD.get(a)!;
          const sb = BOARD.get(b)!;
          const color = TRANSPORT_COLORS[t];
          const isWater = t === "water";
          return (
            <line
              key={`${a}-${b}-${t}`}
              x1={sa.x} y1={sa.y}
              x2={sb.x} y2={sb.y}
              stroke={color}
              strokeWidth={isWater ? 2.5 : t === "underground" ? 2 : t === "bus" ? 1.5 : 1}
              strokeOpacity={isWater ? 0.9 : t === "underground" ? 0.7 : 0.4}
              strokeDasharray={isWater ? "6 3" : t === "underground" ? "none" : "none"}
            />
          );
        })}

        {/* Stations */}
        {Array.from(BOARD.values()).map((station) => {
          const { id, x, y } = station;
          const highlights = highlightMap.get(id);
          const isHighlighted = !!highlights;
          const isSelected = selectedStation === id;
          const isMrXHere = mrxPosition === id;
          const detHere = detMap.get(id);

          // Determine station ring color based on type
          const hasUnderground = station.underground.length > 0;
          const hasBus = station.bus.length > 0;
          const hasWater = station.water.length > 0;

          const ringColor = hasWater
            ? TRANSPORT_COLORS.water
            : hasUnderground
            ? TRANSPORT_COLORS.underground
            : hasBus
            ? TRANSPORT_COLORS.bus
            : TRANSPORT_COLORS.taxi;

          const baseR = hasUnderground || hasWater ? 7 : hasBus ? 5.5 : 4;

          // Highlight glow color
          const highlightColor =
            highlights && highlights.length > 0
              ? TRANSPORT_COLORS[highlights[0] as keyof typeof TRANSPORT_COLORS] ?? "#fff"
              : "#fff";

          return (
            <g
              key={id}
              className="station"
              onClick={() => {
                if (isHighlighted) {
                  onStationClick(id);
                }
              }}
              style={{ cursor: isHighlighted ? "pointer" : "default" }}
            >
              {/* Glow for highlighted */}
              {isHighlighted && (
                <circle
                  cx={x} cy={y}
                  r={baseR + 7}
                  fill={highlightColor}
                  opacity={0.25 + (isSelected ? 0.2 : 0)}
                />
              )}
              {/* Station circle */}
              <circle
                cx={x} cy={y}
                r={baseR}
                fill={isSelected ? "#fff" : "#1a1a2e"}
                stroke={isHighlighted ? highlightColor : ringColor}
                strokeWidth={isSelected ? 2.5 : isHighlighted ? 2 : 1.5}
              />
              {/* Station number */}
              <text
                x={x} y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={hasUnderground || hasWater ? 4.5 : 3.5}
                fill={isSelected ? "#1a1a2e" : "#ccc"}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {id}
              </text>

              {/* Detectives */}
              {detHere?.map((di, offset) => (
                <circle
                  key={di}
                  cx={x + (offset - (detHere.length - 1) / 2) * 6}
                  cy={y - baseR - 5}
                  r={4}
                  fill={DETECTIVE_COLORS[di]}
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}

              {/* Mr. X */}
              {isMrXHere && (
                <text
                  x={x} y={y - baseR - 5}
                  textAnchor="middle"
                  fontSize={10}
                  style={{ pointerEvents: "none" }}
                >
                  🎭
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="board-legend">
        <span style={{ color: TRANSPORT_COLORS.taxi }}>── Taxi</span>
        <span style={{ color: TRANSPORT_COLORS.bus }}>── Bus</span>
        <span style={{ color: TRANSPORT_COLORS.underground }}>── Underground</span>
        <span style={{ color: TRANSPORT_COLORS.water }}>-- Ferry</span>
        <span className="legend-hint">Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  );
}
