import { useMemo, useState } from "react";
import { BOARD, DETECTIVE_COLORS } from "../data/board";
import { SVG_POSITIONS } from "../data/svgPositions";
import React from "react";

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

const TRANSPORT_RING: Record<string, string> = {
  taxi: "#d4a820",
  bus: "#22c55e",
  underground: "#f43f5e",
  water: "#38bdf8",
  black: "#a855f7",
};

export default function GameBoard({
  detectives,
  mrxPosition,
  moveHighlights,
  onStationClick,
  selectedStation,
}: Props) {
  const [viewBox, setViewBox] = useState("0 0 600 450");
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vx: 0, vy: 0, vw: 0, vh: 0 });

  const highlightMap = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const h of moveHighlights) {
      if (!m.has(h.station)) m.set(h.station, []);
      m.get(h.station)!.push(h.transport);
    }
    return m;
  }, [moveHighlights]);

  const detMap = useMemo(() => {
    const m = new Map<number, number[]>();
    detectives.forEach((d, i) => {
      if (!m.has(d.position)) m.set(d.position, []);
      m.get(d.position)!.push(i);
    });
    return m;
  }, [detectives]);

  function parseVB(vb: string) {
    const [x, y, w, h] = vb.split(" ").map(Number);
    return { x, y, w, h };
  }

  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if ((e.target as SVGElement).closest(".station")) return;
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
    const newW = Math.min(Math.max(w * factor, 120), 1800);
    const newH = newW * (450 / 600);
    const cx = x + w / 2;
    const cy = y + h / 2;
    setViewBox(`${cx - newW / 2} ${cy - newH / 2} ${newW} ${newH}`);
  }

  const stationIds = useMemo(() => Array.from(BOARD.keys()), []);

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
        <defs>
          <filter id="glow-ring" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-player" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodOpacity="0.75" />
          </filter>
        </defs>

        {/* Board image */}
        <image
          href="/board.svg"
          x="0" y="0"
          width="600" height="450"
          style={{ pointerEvents: "none" }}
        />

        {/* Station overlays */}
        {stationIds.map((id) => {
          const pos = SVG_POSITIONS.get(id);
          if (!pos) return null;
          const { x, y } = pos;

          const highlights = highlightMap.get(id);
          const isHighlighted = !!highlights;
          const isSelected = selectedStation === id;
          const isMrXHere = mrxPosition === id;
          const detHere = detMap.get(id);
          const hasPlayer = isMrXHere || (detHere && detHere.length > 0);

          const ringColor = highlights
            ? (TRANSPORT_RING[highlights[0]] ?? "#fff")
            : "#fff";

          if (!isHighlighted && !hasPlayer) return null;

          return (
            <g
              key={id}
              className="station"
              onClick={() => { if (isHighlighted) onStationClick(id); }}
              style={{ cursor: isHighlighted ? "pointer" : "default" }}
            >
              {/* Highlight ring */}
              {isHighlighted && (
                <circle
                  cx={x} cy={y} r={15}
                  fill={ringColor}
                  fillOpacity={isSelected ? 0.38 : 0.2}
                  filter="url(#glow-ring)"
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* Detective fill */}
              {detHere && detHere.length > 0 && !isMrXHere && (
                <circle
                  cx={x} cy={y} r={7.5}
                  fill={DETECTIVE_COLORS[detHere[0]]}
                  stroke="#fff"
                  strokeWidth={1.5}
                  filter="url(#glow-player)"
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* Mr. X fill */}
              {isMrXHere && (
                <circle
                  cx={x} cy={y} r={7.5}
                  fill="#0a0a0a"
                  stroke="#e5e7eb"
                  strokeWidth={1.5}
                  filter="url(#glow-player)"
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* Detective label */}
              {detHere && detHere.length > 0 && !isMrXHere && (
                <text
                  x={x} y={y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={5}
                  fontWeight="800"
                  fontFamily="'Courier New', Courier, monospace"
                  fill="#fff"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {detHere.length === 1 ? detHere[0] + 1 : detHere.length}
                </text>
              )}

              {/* Mr. X label */}
              {isMrXHere && (
                <text
                  x={x} y={y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={5.5}
                  fontWeight="800"
                  fontFamily="'Courier New', Courier, monospace"
                  fill="#e5e7eb"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  X
                </text>
              )}

              {/* Transparent click target */}
              {isHighlighted && (
                <circle cx={x} cy={y} r={10} fill="transparent" />
              )}
            </g>
          );
        })}
      </svg>

      <div className="board-legend">
        <span className="legend-hint">Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  );
}
