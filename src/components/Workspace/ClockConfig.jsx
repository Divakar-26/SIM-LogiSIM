// src/components/Workspace/ClockConfig.jsx
//
// Floating panel opened from the node context menu when type === "CLOCK".
// Lets the user set frequency (Hz) and duty cycle (%).

import { useState } from "react";

// ── tiny waveform preview ──────────────────────────────────────────────────
function WaveformPreview({ duty }) {
    const W = 176, H = 30;
    const cycles = 2;
    const cw     = W / cycles;
    const hiW    = cw * duty;
    const loW    = cw * (1 - duty);
    const top = 5, bot = H - 6;

    let d = `M 0 ${bot}`;
    let cx = 0;
    for (let i = 0; i < cycles; i++) {
        d += ` L ${cx} ${top} L ${cx + hiW} ${top} L ${cx + hiW} ${bot}`;
        cx += cw;
        d += ` L ${cx} ${bot}`;
    }

    return (
        <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
            <line x1="0" y1={bot} x2={W} y2={bot} stroke="#2a2a3e" strokeWidth="1" />
            <line x1="0" y1={top} x2={W} y2={top} stroke="#2a2a3e" strokeWidth="1" strokeDasharray="3 3" />
            <path d={d} fill="none" stroke="#89b4fa" strokeWidth="1.5"
                strokeLinejoin="miter" strokeLinecap="square" />
            {/* HIGH label */}
            <text x={hiW / 2} y={top - 2} textAnchor="middle"
                fontSize="8" fill="#89b4fa" fontFamily="monospace">
                {Math.round(duty * 100)}%
            </text>
            {/* LOW label */}
            <text x={hiW + loW / 2} y={bot + 9} textAnchor="middle"
                fontSize="8" fill="#585b70" fontFamily="monospace">
                {Math.round((1 - duty) * 100)}%
            </text>
        </svg>
    );
}

// ── main component ─────────────────────────────────────────────────────────
function ClockConfig({ node, x, y, onSave, onClose }) {
    const initHz   = node.hz   ?? 1;
    const initDuty = Math.round((node.duty ?? 0.5) * 100);

    const [hz,   setHz]   = useState(String(initHz));
    const [duty, setDuty] = useState(String(initDuty));

    const hzNum   = parseFloat(hz);
    const dutyNum = parseFloat(duty);
    const hzOk    = !isNaN(hzNum)   && hzNum   >= 0.1 && hzNum   <= 100;
    const dutyOk  = !isNaN(dutyNum) && dutyNum >= 1   && dutyNum <= 99;
    const valid   = hzOk && dutyOk;

    const periodMs  = hzOk ? 1000 / hzNum : null;
    const periodStr = periodMs === null ? null
        : periodMs >= 1000 ? `${(periodMs / 1000).toFixed(2)} s`
        : `${periodMs.toFixed(0)} ms`;

    const handleSave = () => {
        if (!valid) return;
        onSave({ hz: hzNum, duty: dutyNum / 100 });
    };

    const row = { display: "flex", flexDirection: "column", gap: 5 };
    const lbl = { fontSize: 10, color: "#6c7086", letterSpacing: "0.05em", textTransform: "uppercase" };
    const inp = (ok) => ({
        padding: "6px 9px", borderRadius: 6, fontSize: 13,
        fontFamily: "monospace", outline: "none",
        border: `1px solid ${ok ? "#45475a" : "#f38ba8"}`,
        background: "#181825", color: "#cdd6f4", width: "100%",
        boxSizing: "border-box",
    });

    return (
        <div
            style={{
                position: "fixed", left: x, top: y, zIndex: 3000,
                background: "#1e1e2e", border: "1px solid #45475a",
                borderRadius: 10, padding: "14px 16px",
                width: 220,
                boxShadow: "0 6px 28px rgba(0,0,0,0.6)",
                display: "flex", flexDirection: "column", gap: 13,
                userSelect: "none",
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
        >
            {/* ── header ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {/* clock icon */}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" stroke="#89b4fa" strokeWidth="1.5"/>
                        <line x1="7" y1="3.5" x2="7" y2="7" stroke="#89b4fa" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="7" y1="7" x2="10" y2="8.5" stroke="#a6e3a1" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#cdd6f4", letterSpacing: "0.06em" }}>
                        CLOCK
                    </span>
                </div>
                <button onClick={onClose} style={{
                    background: "none", border: "none", color: "#6c7086",
                    cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#cdd6f4"}
                onMouseLeave={e => e.currentTarget.style.color = "#6c7086"}
                >✕</button>
            </div>

            {/* ── frequency ── */}
            <div style={row}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={lbl}>Frequency</span>
                    {periodStr && (
                        <span style={{ fontSize: 9, color: "#45475a", fontFamily: "monospace" }}>
                            T = {periodStr}
                        </span>
                    )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                        type="number" min="0.1" max="100" step="0.1"
                        value={hz}
                        onChange={e => setHz(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSave()}
                        style={inp(hzOk)}
                        onFocus={e => e.currentTarget.style.borderColor = "#89b4fa"}
                        onBlur={e  => e.currentTarget.style.borderColor = hzOk ? "#45475a" : "#f38ba8"}
                    />
                    <span style={{ fontSize: 11, color: "#6c7086", flexShrink: 0 }}>Hz</span>
                </div>
                {!hzOk && hz !== "" && (
                    <span style={{ fontSize: 9, color: "#f38ba8" }}>0.1 – 100 Hz</span>
                )}

                {/* Quick presets */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                    {[0.5, 1, 2, 5, 10].map(v => (
                        <button key={v} onClick={() => setHz(String(v))} style={{
                            padding: "2px 7px", borderRadius: 4,
                            border: `1px solid ${parseFloat(hz) === v ? "#89b4fa" : "#313244"}`,
                            background: parseFloat(hz) === v ? "rgba(137,180,250,0.15)" : "transparent",
                            color: parseFloat(hz) === v ? "#89b4fa" : "#585b70",
                            fontSize: 10, fontFamily: "monospace", cursor: "pointer",
                        }}>{v}</button>
                    ))}
                </div>
            </div>

            {/* ── duty cycle ── */}
            <div style={row}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={lbl}>Duty cycle</span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#cdd6f4" }}>
                        {isNaN(dutyNum) ? "--" : Math.round(dutyNum)}%
                    </span>
                </div>
                <input
                    type="range" min="1" max="99" step="1"
                    value={isNaN(dutyNum) ? 50 : Math.max(1, Math.min(99, Math.round(dutyNum)))}
                    onChange={e => setDuty(e.target.value)}
                    style={{ accentColor: "#89b4fa", width: "100%" }}
                />
                {/* Waveform preview */}
                {hzOk && dutyOk && (
                    <div style={{ marginTop: 2 }}>
                        <WaveformPreview duty={dutyNum / 100} />
                    </div>
                )}
            </div>

            {/* ── buttons ── */} 
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                <button onClick={onClose} style={{
                    flex: 1, padding: "7px 0", borderRadius: 6,
                    border: "1px solid #45475a", background: "transparent",
                    color: "#cdd6f4", cursor: "pointer", fontSize: 12,
                }}>Cancel</button> 
                <button onClick={handleSave} disabled={!valid} style={{
                    flex: 1, padding: "7px 0", borderRadius: 6,
                    border: "none",
                    background: valid ? "#89b4fa" : "#313244",
                    color: valid ? "#1e1e2e" : "#45475a",
                    fontWeight: 700,
                    cursor: valid ? "pointer" : "not-allowed",
                    fontSize: 12,
                }}>Apply</button>
            </div>
        </div>
    );
}

export default ClockConfig;