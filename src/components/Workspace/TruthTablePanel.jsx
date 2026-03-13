import { useState, useMemo } from "react";
import { customComponentRegistry } from "../../configs/customComponents";

const INPUT_NAMES  = ["A", "B", "Cin", "D", "E", "F", "G", "H"];
const OUTPUT_NAMES = ["Q", "S", "Cout", "Y", "Z", "W"];

function getInputName(i, label)  { return label || INPUT_NAMES[i]  || `I${i}`; }
function getOutputName(i, label) { return label || OUTPUT_NAMES[i] || `O${i}`; }

function evalBuiltin(type, inputs) {
    switch (type) {
        case "AND": return [inputs[0] & inputs[1]];
        case "OR":  return [inputs[0] | inputs[1]];
        case "NOT": return [inputs[0] ? 0 : 1];
        default:    return [0];
    }
}
const BUILTIN = { AND: [2,1], OR: [2,1], NOT: [1,1] };

function buildRows(type) {
    const custom = customComponentRegistry[type];
    if (custom) {
        const ic = custom.inputCount, oc = custom.outputCount;
        const inputLabels  = custom.inputPinMap.map(({ nodeId }, i) =>
            getInputName(i, custom.nodes.find(n => n.id === nodeId)?.label || null));
        const outputLabels = custom.outputPinMap.map(({ nodeId }, i) =>
            getOutputName(i, custom.nodes.find(n => n.id === nodeId)?.label || null));
        const rows = [];
        for (let c = 0; c < (1 << ic); c++) {
            const ins  = Array.from({ length: ic }, (_, b) => (c >> (ic-1-b)) & 1);
            const outs = custom.truthTable?.[ins.join("")] ?? new Array(oc).fill(0);
            rows.push({ ins, outs });
        }
        return { inputLabels, outputLabels, rows, inputCount: ic };
    }
    if (BUILTIN[type]) {
        const [ic, oc] = BUILTIN[type];
        const inputLabels  = Array.from({ length: ic }, (_, i) => getInputName(i, null));
        const outputLabels = Array.from({ length: oc }, (_, i) => getOutputName(i, null));
        const rows = [];
        for (let c = 0; c < (1 << ic); c++) {
            const ins  = Array.from({ length: ic }, (_, b) => (c >> (ic-1-b)) & 1);
            rows.push({ ins, outs: evalBuiltin(type, ins) });
        }
        return { inputLabels, outputLabels, rows, inputCount: ic };
    }
    return null;
}

// ── Filter bar ────────────────────────────────────────────────────────────────
// User types a pattern like "1_0" — '_' or '?' matches either bit.
// Digits 0/1 must match exactly. Anything else ignored.
function matchesFilter(ins, pattern) {
    if (!pattern) return true;
    const clean = pattern.replace(/[^01_?x]/gi, "");
    for (let i = 0; i < clean.length && i < ins.length; i++) {
        const ch = clean[i];
        if (ch === "0" && ins[i] !== 0) return false;
        if (ch === "1" && ins[i] !== 1) return false;
        // '_', '?', 'x' are wildcards — skip
    }
    return true;
}

// ── Panel ─────────────────────────────────────────────────────────────────────
function TruthTablePanel({ type, onClose }) {
    const [filter, setFilter] = useState("");
    const data = useMemo(() => buildRows(type), [type]);
    if (!data) return null;

    const { inputLabels, outputLabels, rows, inputCount } = data;
    const isLarge = rows.length > 16;

    const filtered = useMemo(() =>
        rows.filter(r => matchesFilter(r.ins, filter)),
        [rows, filter]
    );

    const cell = (val) => ({
        padding: "4px 10px",
        textAlign: "center",
        fontSize: "12px",
        fontFamily: "monospace",
        color: val === 1 ? "#a6e3a1" : "#585b70",
        fontWeight: val === 1 ? 700 : 400,
        minWidth: 28,
    });

    const headerCell = {
        padding: "5px 10px",
        textAlign: "center",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        minWidth: 28,
        position: "sticky",
        top: 0,
        background: "#1e1e2e",
        zIndex: 1,
    };

    return (
        <div style={{
            position: "absolute", top: 14, right: 14, zIndex: 500,
            background: "#1e1e2e", border: "1px solid #313244",
            borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            minWidth: 180, maxWidth: 380,
            display: "flex", flexDirection: "column",
            userSelect: "none",
            maxHeight: "calc(100vh - 80px)",
            overflow: "hidden",
        }}>
            {/* ── Header ── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px 8px", borderBottom: "1px solid #313244", flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#cdd6f4", letterSpacing: "0.04em" }}>
                        {type}
                    </span>
                    <span style={{ fontSize: 10, color: "#45475a" }}>
                        {inputCount} in · {rows.length} rows
                    </span>
                </div>
                <button onClick={onClose} style={{
                    background: "transparent", border: "none", color: "#6c7086",
                    cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px", borderRadius: 4,
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#cdd6f4"}
                onMouseLeave={e => e.currentTarget.style.color = "#6c7086"}
                >✕</button>
            </div>

            {/* ── Filter bar (only shown for large tables) ── */}
            {isLarge && (
                <div style={{ padding: "7px 10px", borderBottom: "1px solid #313244", flexShrink: 0 }}>
                    <input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder={`Filter inputs… e.g. 1_0 (${filtered.length}/${rows.length})`}
                        style={{
                            width: "100%", boxSizing: "border-box",
                            background: "#181825", border: "1px solid #313244",
                            borderRadius: 5, padding: "5px 9px",
                            fontSize: 11, fontFamily: "monospace",
                            color: "#cdd6f4", outline: "none",
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = "#89b4fa"}
                        onBlur={e  => e.currentTarget.style.borderColor = "#313244"}
                    />
                </div>
            )}

            {/* ── Table ── */}
            <div style={{ overflowY: "auto", overflowX: "auto", flex: 1 }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#45475a", fontSize: 12 }}>
                        No rows match
                    </div>
                ) : (
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #313244" }}>
                                {inputLabels.map((lbl, i) => (
                                    <th key={`ih-${i}`} style={{ ...headerCell, color: "#89b4fa" }}>{lbl}</th>
                                ))}
                                <th style={{ ...headerCell, color: "#313244", padding: "5px 3px", minWidth: 10 }}>│</th>
                                {outputLabels.map((lbl, i) => (
                                    <th key={`oh-${i}`} style={{ ...headerCell, color: "#a6e3a1" }}>{lbl}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(({ ins, outs }, ri) => (
                                <tr key={ri} style={{
                                    background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.018)",
                                }}>
                                    {ins.map((v, i)  => <td key={`i-${i}`} style={cell(v)}>{v}</td>)}
                                    <td style={{ color: "#313244", textAlign: "center", fontSize: 12, fontFamily: "monospace", padding: "4px 3px" }}>│</td>
                                    {outs.map((v, i) => <td key={`o-${i}`} style={cell(v)}>{v}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Footer ── */}
            <div style={{
                padding: "5px 12px", borderTop: "1px solid #313244",
                display: "flex", gap: 12, fontSize: 10, color: "#45475a", flexShrink: 0,
            }}>
                <span><span style={{ color: "#89b4fa" }}>■</span> in</span>
                <span><span style={{ color: "#a6e3a1" }}>■</span> out</span>
                {isLarge && <span style={{ color: "#313244" }}>_ or ? = wildcard</span>}
            </div>
        </div>
    );
}

export default TruthTablePanel;