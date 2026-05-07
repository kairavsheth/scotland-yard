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

const PAD = 24;
const VB = `${-PAD} ${-PAD} ${BOARD_WIDTH + PAD * 2} ${BOARD_HEIGHT + PAD * 2}`;

// Build per-transport edge lists (deduplicated) for layered rendering
const EDGES_BY_TYPE = (() => {
  const result: Record<Transport, { a: number; b: number }[]> = {
    taxi: [], bus: [], underground: [], water: [],
  };
  const seen = new Set<string>();
  for (const [id, station] of BOARD) {
    for (const t of ["taxi", "bus", "underground", "water"] as Transport[]) {
      for (const nb of station[t]) {
        const key = [Math.min(id, nb), Math.max(id, nb), t].join("-");
        if (!seen.has(key)) {
          seen.add(key);
          result[t].push({ a: id, b: nb });
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
    const newW = Math.min(Math.max(w * factor, 200), BOARD_WIDTH * 3);
    const newH = Math.min(Math.max(h * factor, 150), BOARD_HEIGHT * 3);
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
        <defs>
          <filter id="glow-red" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-blue" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-node-red" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f43f5e" floodOpacity="0.65" />
          </filter>
          <filter id="glow-node-blue" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.65" />
          </filter>
          <filter id="glow-highlight" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect
          x={-PAD} y={-PAD}
          width={BOARD_WIDTH + PAD * 2}
          height={BOARD_HEIGHT + PAD * 2}
          fill="#0b0b1a"
        />

        {/* ── Edges — layered: taxi at bottom, water on top ── */}

        {/* Taxi: very dim connectivity web */}
        <g>
          {EDGES_BY_TYPE.taxi.map(({ a, b }) => {
            const sa = BOARD.get(a)!, sb = BOARD.get(b)!;
            return (
              <line key={`${a}-${b}`}
                x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y}
                stroke={TRANSPORT_COLORS.taxi} strokeWidth={0.7} strokeOpacity={0.14} />
            );
          })}
        </g>

        {/* Bus: clearly visible */}
        <g>
          {EDGES_BY_TYPE.bus.map(({ a, b }) => {
            const sa = BOARD.get(a)!, sb = BOARD.get(b)!;
            return (
              <line key={`${a}-${b}`}
                x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y}
                stroke={TRANSPORT_COLORS.bus} strokeWidth={1.5} strokeOpacity={0.55} />
            );
          })}
        </g>

        {/* Underground: bright with red glow */}
        <g filter="url(#glow-red)">
          {EDGES_BY_TYPE.underground.map(({ a, b }) => {
            const sa = BOARD.get(a)!, sb = BOARD.get(b)!;
            return (
              <line key={`${a}-${b}`}
                x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y}
                stroke={TRANSPORT_COLORS.underground} strokeWidth={2.5} strokeOpacity={0.85} />
            );
          })}
        </g>

        {/* Ferry: dashed with blue glow */}
        <g filter="url(#glow-blue)">
          {EDGES_BY_TYPE.water.map(({ a, b }) => {
            const sa = BOARD.get(a)!, sb = BOARD.get(b)!;
            return (
              <line key={`${a}-${b}`}
                x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y}
                stroke={TRANSPORT_COLORS.water} strokeWidth={2.5} strokeOpacity={0.9}
                strokeDasharray="8 4" />
            );
          })}
        </g>

        {/* ── Stations ── */}
        {Array.from(BOARD.values()).map((station) => {
          const { id, x, y } = station;
          const highlights = highlightMap.get(id);
          const isHighlighted = !!highlights;
          const isSelected = selectedStation === id;
          const isMrXHere = mrxPosition === id;
          const detHere = detMap.get(id);

          const hasUnderground = station.underground.length > 0;
          const hasBus = station.bus.length > 0;
          const hasWater = station.water.length > 0;

          // Visual tier determines size, color, glow
          const tier = hasWater ? "water"
            : hasUnderground ? "underground"
            : hasBus ? "bus"
            : "taxi";
          const primaryColor = TRANSPORT_COLORS[tier];

          const baseR = tier === "water" || tier === "underground" ? 9
            : tier === "bus" ? 7 : 5;
          const fontSize = tier === "water" || tier === "underground" ? 5.5
            : tier === "bus" ? 4.5 : 4;

          const nodeFill = isSelected ? "#ffffff"
            : tier === "water" ? "#050d1e"
            : tier === "underground" ? "#1e0508"
            : tier === "bus" ? "#051a09"
            : "#0e0d1c";

          const ringColor = isHighlighted
            ? (TRANSPORT_COLORS[highlights![0] as keyof typeof TRANSPORT_COLORS] ?? "#fff")
            : primaryColor;
          const ringWidth = isSelected ? 2.5
            : isHighlighted ? 2.2
            : tier === "water" || tier === "underground" ? 2
            : tier === "bus" ? 1.6 : 1.2;

          // Pips indicate non-taxi transports available at this station
          const pips: string[] = [];
          if (hasUnderground) pips.push(TRANSPORT_COLORS.underground);
          if (hasBus) pips.push(TRANSPORT_COLORS.bus);
          if (hasWater) pips.push(TRANSPORT_COLORS.water);

          // Approx label background size
          const numLen = id.toString().length;
          const labelW = numLen * fontSize * 0.62 + 2;
          const labelH = fontSize * 1.1;

          return (
            <g
              key={id}
              className="station"
              onClick={() => { if (isHighlighted) onStationClick(id); }}
              style={{ cursor: isHighlighted ? "pointer" : "default" }}
            >
              {/* Highlight glow pulse */}
              {isHighlighted && (
                <circle cx={x} cy={y} r={baseR + 10} fill={ringColor}
                  opacity={isSelected ? 0.28 : 0.17}
                  filter="url(#glow-highlight)" />
              )}

              {/* Outer halo ring for underground/water — marks importance */}
              {(tier === "underground" || tier === "water") && !isHighlighted && (
                <circle cx={x} cy={y} r={baseR + 3} fill="none"
                  stroke={primaryColor} strokeWidth={0.8} strokeOpacity={0.28} />
              )}

              {/* Station circle — underground/water get node glow */}
              <circle
                cx={x} cy={y} r={baseR}
                fill={nodeFill}
                stroke={ringColor}
                strokeWidth={ringWidth}
                filter={
                  isHighlighted ? undefined
                  : tier === "underground" ? "url(#glow-node-red)"
                  : tier === "water" ? "url(#glow-node-blue)"
                  : undefined
                }
              />

              {/* Number — label background rect for contrast */}
              <rect
                x={x - labelW / 2} y={y - labelH / 2}
                width={labelW} height={labelH}
                rx={1.5} fill={nodeFill}
                style={{ pointerEvents: "none" }}
              />
              <text
                x={x} y={y + 0.5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={fontSize} fontWeight="700"
                fontFamily="'Courier New', Courier, monospace"
                fill={isSelected ? "#0b0b1a" : "#eeeef8"}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {id}
              </text>

              {/* Transport mode pips below the label */}
              {pips.length > 0 && (
                <g style={{ pointerEvents: "none" }}>
                  {pips.map((color, i) => (
                    <circle
                      key={i}
                      cx={x + (i - (pips.length - 1) / 2) * 3.8}
                      cy={y + baseR + 4.5}
                      r={1.8}
                      fill={color}
                      opacity={0.9}
                    />
                  ))}
                </g>
              )}

              {/* Detectives — numbered tokens */}
              {detHere?.map((di, offset) => (
                <g key={di}>
                  <circle
                    cx={x + (offset - (detHere.length - 1) / 2) * 8}
                    cy={y - baseR - 7}
                    r={5}
                    fill={DETECTIVE_COLORS[di]}
                    stroke="#fff" strokeWidth={1.2}
                  />
                  <text
                    x={x + (offset - (detHere.length - 1) / 2) * 8}
                    y={y - baseR - 6.5}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={4.5} fontWeight="800" fill="#fff"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {di + 1}
                  </text>
                </g>
              ))}

              {/* Mr. X */}
              {isMrXHere && (
                <text
                  x={x} y={y - baseR - 7}
                  textAnchor="middle" fontSize={13}
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
        <span style={{ color: TRANSPORT_COLORS.water }}>╌╌ Ferry</span>
        <span className="legend-divider">│</span>
        <span className="legend-pips">
          Dots:&nbsp;
          <span className="legend-pip" style={{ background: TRANSPORT_COLORS.underground }} />U&nbsp;
          <span className="legend-pip" style={{ background: TRANSPORT_COLORS.bus }} />B&nbsp;
          <span className="legend-pip" style={{ background: TRANSPORT_COLORS.water }} />F
        </span>
        <span className="legend-hint">Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  );
}
