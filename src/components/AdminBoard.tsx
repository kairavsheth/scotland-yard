import React, { useState, useMemo } from "react";
import { BOARD, TRANSPORT_COLORS, TRANSPORT_LABELS } from "../data/board";
import type { Transport } from "../data/board";
import { SVG_POSITIONS } from "../data/svgPositions";

const TRANSPORTS: Transport[] = ["taxi", "bus", "underground", "water"];

export default function AdminBoard() {
  const [selected, setSelected] = useState<number | null>(null);
  const [viewBox, setViewBox] = useState("0 0 600 450");
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vx: 0, vy: 0, vw: 0, vh: 0 });

  const stationIds = useMemo(() => Array.from(BOARD.keys()).sort((a, b) => a - b), []);
  const selectedStation = selected !== null ? BOARD.get(selected) : null;

  const missingPositions = useMemo(
    () => stationIds.filter((id) => !SVG_POSITIONS.get(id)),
    [stationIds]
  );

  // For each neighbor of the selected station, collect which transports connect it
  const neighborTransports = useMemo(() => {
    if (!selectedStation) return new Map<number, Transport[]>();
    const m = new Map<number, Transport[]>();
    for (const t of TRANSPORTS) {
      for (const n of selectedStation[t]) {
        if (!m.has(n)) m.set(n, []);
        m.get(n)!.push(t);
      }
    }
    return m;
  }, [selectedStation]);

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
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - panStart.x) / rect.width) * panStart.vw;
    const dy = ((e.clientY - panStart.y) / rect.height) * panStart.vh;
    setViewBox(`${panStart.vx - dx} ${panStart.vy - dy} ${panStart.vw} ${panStart.vh}`);
  }

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

  // Pick a representative ring color for a neighbor (best transport)
  function neighborColor(id: number): string {
    const transports = neighborTransports.get(id);
    if (!transports) return "#ffffff22";
    if (transports.includes("underground")) return TRANSPORT_COLORS.underground;
    if (transports.includes("bus")) return TRANSPORT_COLORS.bus;
    if (transports.includes("taxi")) return TRANSPORT_COLORS.taxi;
    if (transports.includes("water")) return TRANSPORT_COLORS.water;
    return "#fff";
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f0f13", color: "#e5e7eb", fontFamily: "monospace", overflow: "hidden" }}>
      {/* Board */}
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "#00000088", padding: "4px 8px", borderRadius: 4, fontSize: 11, color: "#888" }}>
          Admin Audit — scroll to zoom · drag to pan · click station to inspect
        </div>
        <svg
          viewBox={viewBox}
          style={{ width: "100%", height: "100%", cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
          onWheel={onWheel}
        >
          <image href="/board.svg" x="0" y="0" width="600" height="450" style={{ pointerEvents: "none" }} />

          {stationIds.map((id) => {
            const pos = SVG_POSITIONS.get(id);
            if (!pos) return null;
            const { x, y } = pos;
            const isSelected = selected === id;
            const isNeighbor = neighborTransports.has(id);
            const color = isSelected ? "#ffffff" : isNeighbor ? neighborColor(id) : "#ffffff33";

            return (
              <g key={id} className="station" onClick={() => setSelected(id)} style={{ cursor: "pointer" }}>
                <circle
                  cx={x} cy={y} r={isSelected || isNeighbor ? 8.5 : 7}
                  fill={isSelected ? "#fff" : isNeighbor ? color + "33" : "#00000055"}
                  stroke={color}
                  strokeWidth={isSelected ? 1.5 : isNeighbor ? 1.5 : 0.8}
                />
                <text
                  x={x} y={y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={3.5}
                  fill={isSelected ? "#000" : isNeighbor ? color : "#ffffffaa"}
                  fontWeight={isSelected || isNeighbor ? "bold" : "normal"}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {id}
                </text>
                {/* Transparent hit target */}
                <circle cx={x} cy={y} r={10} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right panel */}
      <div style={{ width: 300, borderLeft: "1px solid #2a2a3a", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a3a" }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: 1 }}>SCOTLAND YARD / ADMIN</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Graph Audit Tool</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {selected === null ? (
            <p style={{ color: "#444", fontSize: 13, margin: 0 }}>Click any station on the board to inspect its connections.</p>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 24, fontWeight: "bold" }}>{selected}</span>
                <span style={{ fontSize: 12, color: "#555", marginLeft: 8 }}>
                  {neighborTransports.size} neighbor{neighborTransports.size !== 1 ? "s" : ""}
                </span>
              </div>

              {TRANSPORTS.map((t) => {
                const neighbors = (selectedStation?.[t] ?? []).slice().sort((a, b) => a - b);
                if (neighbors.length === 0) return null;
                return (
                  <div key={t} style={{ marginBottom: 14 }}>
                    <div style={{ color: TRANSPORT_COLORS[t], fontSize: 11, marginBottom: 6, letterSpacing: 0.5, fontWeight: "bold" }}>
                      {TRANSPORT_LABELS[t].toUpperCase()} · {neighbors.length}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {neighbors.map((n) => (
                        <button
                          key={n}
                          onClick={() => setSelected(n)}
                          style={{
                            padding: "3px 8px",
                            background: "#1a1a24",
                            border: `1px solid ${TRANSPORT_COLORS[t]}55`,
                            borderRadius: 4,
                            fontSize: 12,
                            cursor: "pointer",
                            color: TRANSPORT_COLORS[t],
                            fontFamily: "monospace",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {missingPositions.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #2a2a3a" }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 6, letterSpacing: 0.5 }}>NO SVG POSITION · {missingPositions.length}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {missingPositions.map((id) => (
                  <span key={id} style={{ color: "#f87171", fontSize: 11 }}>{id}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
