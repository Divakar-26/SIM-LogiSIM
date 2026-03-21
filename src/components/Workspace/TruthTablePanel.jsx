// TruthTablePanel.jsx

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

// ── Quine-McCluskey simplification ───────────────────────────────────────────

function tryMerge(a, b) {
    let diff = 0, pos = -1;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) { diff++; pos = i; }
        if (diff > 1) return null;
    }
    if (diff === 0) return null;
    return a.slice(0, pos) + "-" + a.slice(pos + 1);
}

function qmc(minterms, inputCount) {
    if (minterms.length === 0) return "0";
    const total = 1 << inputCount;
    if (minterms.length === total) return "1";

    let implicants = minterms.map(m => ({
        str: m.toString(2).padStart(inputCount, "0"),
        minterms: new Set([m]),
        used: false,
    }));

    const primes = [];

    while (true) {
        const groups = {};
        implicants.forEach(imp => {
            const ones = (imp.str.match(/1/g) || []).length;
            if (!groups[ones]) groups[ones] = [];
            groups[ones].push(imp);
        });

        const nextImplicants = [];
        const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);
        const merged = new Set();

        for (let k = 0; k < keys.length - 1; k++) {
            const g1 = groups[keys[k]], g2 = groups[keys[k + 1]];
            for (const a of g1) {
                for (const b of g2) {
                    const m = tryMerge(a.str, b.str);
                    if (m !== null) {
                        const combined = new Set([...a.minterms, ...b.minterms]);
                        const key = m + [...combined].sort().join(",");
                        if (!merged.has(key)) {
                            merged.add(key);
                            nextImplicants.push({ str: m, minterms: combined, used: false });
                        }
                        a.used = true; b.used = true;
                    }
                }
            }
        }

        implicants.forEach(imp => { if (!imp.used) primes.push(imp); });
        if (nextImplicants.length === 0) break;
        implicants = nextImplicants;
    }

    const mintermSet = new Set(minterms);
    const covered = new Set();
    const chosen = [];

    primes.sort((a, b) => (b.str.match(/-/g)||[]).length - (a.str.match(/-/g)||[]).length);

    for (const prime of primes) {
        const uncovered = [...prime.minterms].filter(m => !covered.has(m));
        if (uncovered.length > 0) {
            chosen.push(prime);
            uncovered.forEach(m => covered.add(m));
        }
        if (covered.size === mintermSet.size) break;
    }

    return chosen.map(imp => {
        const literals = [];
        for (let i = 0; i < imp.str.length; i++) {
            if (imp.str[i] === "1") literals.push(INPUT_NAMES[i] || `I${i}`);
            else if (imp.str[i] === "0") literals.push((INPUT_NAMES[i] || `I${i}`) + "̄");
        }
        if (literals.length === 0) return "1";
        return literals.join("");
    }).join(" + ") || "0";
}

function generateExpressions(rows, inputLabels, outputLabels) {
    const inputCount = inputLabels.length;
    if (inputCount > 6) return null;

    return outputLabels.map((outLabel, oi) => {
        const minterms = rows
            .filter(r => r.outs[oi] === 1)
            .map(r => parseInt(r.ins.join(""), 2));
        const expr = qmc(minterms, inputCount);
        let labeled = expr;
        const sorted = inputLabels
            .map((lbl, i) => ({ lbl, fallback: INPUT_NAMES[i] || `I${i}` }))
            .sort((a, b) => b.fallback.length - a.fallback.length);
        sorted.forEach(({ lbl, fallback }) => {
            labeled = labeled
                .replaceAll(fallback + "̄", lbl + "̄")
                .replaceAll(fallback, lbl);
        });
        return { label: outLabel, expr: labeled };
    });
}

function renderExpr(expr) { return expr; }

// ── Filter ────────────────────────────────────────────────────────────────────
function matchesFilter(ins, pattern) {
    if (!pattern) return true;
    const clean = pattern.replace(/[^01_?x]/gi, "");
    for (let i = 0; i < clean.length && i < ins.length; i++) {
        const ch = clean[i];
        if (ch === "0" && ins[i] !== 0) return false;
        if (ch === "1" && ins[i] !== 1) return false;
    }
    return true;
}

// ── K-Map ─────────────────────────────────────────────────────────────────────
// Gray code sequences for K-Map axes
const GRAY2 = ["00","01","11","10"];
const GRAY1 = ["0","1"];

// Returns { cells, rowHeaders, colHeaders, rowLabel, colLabel }
// for a given inputCount and output column index.
function buildKMap(rows, inputLabels, outputIndex, inputCount) {
    // Only support 2, 3, 4 inputs
    if (inputCount < 2 || inputCount > 4) return null;

    // For 2 vars: rows=A(1 bit), cols=B(1 bit) — use GRAY1 × GRAY1 but laid in 1×4 style
    // Actually layout:
    //   2 vars: 1 row var (A), 1 col var (B) → 2×2 grid but shown as 1 row × 4 pattern
    //   3 vars: row var = C (1 bit), col vars = AB (2 bits)
    //   4 vars: row vars = CD (2 bits), col vars = AB (2 bits)

    let rowBits, colBits;
    if (inputCount === 2) {
        rowBits = [0]; colBits = [1];         // A rows, B cols
    } else if (inputCount === 3) {
        rowBits = [2]; colBits = [0, 1];      // C rows, AB cols
    } else {
        rowBits = [2, 3]; colBits = [0, 1];   // CD rows, AB cols
    }

    const rowGray = rowBits.length === 1 ? GRAY1 : GRAY2;
    const colGray = colBits.length === 1 ? GRAY1 : GRAY2;

    // Build lookup: inputStr → output value
    const lookup = {};
    rows.forEach(r => {
        const key = r.ins.join("");
        lookup[key] = r.outs[outputIndex] ?? 0;
    });

    const cells = [];
    for (const rg of rowGray) {
        const rowCells = [];
        for (const cg of colGray) {
            // Build the full input vector
            const vec = new Array(inputCount).fill(0);
            rowBits.forEach((b, i) => { vec[b] = parseInt(rg[i]); });
            colBits.forEach((b, i) => { vec[b] = parseInt(cg[i]); });
            const key = vec.join("");
            const minterm = parseInt(key, 2);
            rowCells.push({ val: lookup[key] ?? 0, minterm, key });
        }
        cells.push(rowCells);
    }

    const rowLabel = rowBits.map(b => inputLabels[b] || INPUT_NAMES[b]).join("");
    const colLabel = colBits.map(b => inputLabels[b] || INPUT_NAMES[b]).join("");

    return { cells, rowGray, colGray, rowLabel, colLabel };
}

// Compute implicant groups from QMC primes and return colored group overlays
// Returns array of { minterms: Set, color }
const GROUP_COLORS = [
    "rgba(137,180,250,0.22)",  // blue
    "rgba(250,179,135,0.22)",  // peach
    "rgba(203,166,247,0.22)",  // mauve
    "rgba(166,227,161,0.22)",  // green
    "rgba(249,226,175,0.22)",  // yellow
    "rgba(243,139,168,0.22)",  // pink
];
const GROUP_BORDER_COLORS = [
    "#89b4fa", "#fab387", "#cba6f7", "#a6e3a1", "#f9e2af", "#f38ba8"
];

function getKMapGroups(rows, outputIndex, inputCount) {
    if (inputCount < 2 || inputCount > 4) return [];
    const minterms = rows
        .filter(r => r.outs[outputIndex] === 1)
        .map(r => parseInt(r.ins.join(""), 2));
    if (minterms.length === 0 || minterms.length === (1 << inputCount)) return [];

    // Re-run a simplified grouping: extract prime implicants from QMC
    let implicants = minterms.map(m => ({
        str: m.toString(2).padStart(inputCount, "0"),
        minterms: new Set([m]),
        used: false,
    }));

    const primes = [];
    while (true) {
        const groups = {};
        implicants.forEach(imp => {
            const ones = (imp.str.match(/1/g) || []).length;
            if (!groups[ones]) groups[ones] = [];
            groups[ones].push(imp);
        });
        const nextImplicants = [];
        const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);
        const merged = new Set();
        for (let k = 0; k < keys.length - 1; k++) {
            const g1 = groups[keys[k]], g2 = groups[keys[k + 1]];
            for (const a of g1) {
                for (const b of g2) {
                    const m = tryMerge(a.str, b.str);
                    if (m !== null) {
                        const combined = new Set([...a.minterms, ...b.minterms]);
                        const key = m + [...combined].sort().join(",");
                        if (!merged.has(key)) {
                            merged.add(key);
                            nextImplicants.push({ str: m, minterms: combined, used: false });
                        }
                        a.used = true; b.used = true;
                    }
                }
            }
        }
        implicants.forEach(imp => { if (!imp.used) primes.push(imp); });
        if (nextImplicants.length === 0) break;
        implicants = nextImplicants;
    }

    const mintermSet = new Set(minterms);
    const covered = new Set();
    const chosen = [];
    primes.sort((a, b) => (b.str.match(/-/g)||[]).length - (a.str.match(/-/g)||[]).length);
    for (const prime of primes) {
        const uncovered = [...prime.minterms].filter(m => !covered.has(m));
        if (uncovered.length > 0) {
            chosen.push(prime);
            uncovered.forEach(m => covered.add(m));
        }
        if (covered.size === mintermSet.size) break;
    }

    return chosen.map((imp, i) => ({
        minterms: imp.minterms,
        color: GROUP_COLORS[i % GROUP_COLORS.length],
        border: GROUP_BORDER_COLORS[i % GROUP_BORDER_COLORS.length],
    }));
}

// ── KMapPanel sub-component ───────────────────────────────────────────────────
function KMapPanel({ rows, inputLabels, outputLabels, inputCount }) {
    const [selectedOutput, setSelectedOutput] = useState(0);

    const kmap       = useMemo(() => buildKMap(rows, inputLabels, selectedOutput, inputCount), [rows, inputLabels, selectedOutput, inputCount]);
    const groups     = useMemo(() => getKMapGroups(rows, selectedOutput, inputCount), [rows, selectedOutput, inputCount]);
    const expressions = useMemo(() => generateExpressions(rows, inputLabels, outputLabels), [rows, inputLabels, outputLabels]);

    if (!kmap) {
        return (
            <div style={{ padding: "20px", textAlign: "center", color: "#45475a", fontSize: 12 }}>
                K-Map available for 2–4 inputs only (this component has {inputCount}).
            </div>
        );
    }

    const CELL = 44;   // cell size px
    const GAP  = 1;    // gap between cells

    // Map minterm → {ri, ci}
    const mintermToPos = {};
    kmap.cells.forEach((row, ri) => row.forEach((cell, ci) => {
        mintermToPos[cell.minterm] = { ri, ci };
    }));

    const colCount = kmap.colGray.length;
    const rowCount = kmap.rowGray.length;

    // Compute group overlays
    const groupOverlays = groups.map(g => {
        const positions = [...g.minterms].map(m => mintermToPos[m]).filter(Boolean);
        if (!positions.length) return null;
        const rowSet = new Set(positions.map(p => p.ri));
        const colSet = new Set(positions.map(p => p.ci));
        const minRow = Math.min(...rowSet), maxRow = Math.max(...rowSet);
        const minCol = Math.min(...colSet), maxCol = Math.max(...colSet);
        // Non-contiguous = wrapping group
        const contiguousRows = maxRow - minRow + 1 === rowSet.size;
        const contiguousCols = maxCol - minCol + 1 === colSet.size;
        return { minRow, maxRow, minCol, maxCol, rowSet, colSet, contiguousRows, contiguousCols, color: g.color, border: g.border };
    }).filter(Boolean);

    return (
        <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* ── Output selector ── */}
            {outputLabels.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#6c7086", letterSpacing: "0.06em", textTransform: "uppercase" }}>Output</span>
                    <div style={{ display: "flex", gap: 4 }}>
                        {outputLabels.map((lbl, i) => (
                            <button key={i} onClick={() => setSelectedOutput(i)} style={{
                                padding: "2px 10px", borderRadius: 5, border: "1px solid",
                                fontSize: 11, fontWeight: 700, cursor: "pointer",
                                background: selectedOutput === i ? "rgba(137,180,250,0.15)" : "transparent",
                                borderColor: selectedOutput === i ? "rgba(137,180,250,0.4)" : "#313244",
                                color: selectedOutput === i ? "#89b4fa" : "#585b70",
                                transition: "all .12s",
                            }}>{lbl}</button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── K-Map grid ── */}
            {/*
                Layout (flex column):
                  [col-axis row]   →  empty corner | col-label+arrow | col-label+arrow ...
                  [data rows]      →  row-header   | cell            | cell ...

                The corner cell (top-left) shows the diagonal split label: colVar\rowVar
            */}
            <div style={{ overflowX: "auto" }}>
                <table style={{
                    borderCollapse: "separate",
                    borderSpacing: GAP,
                    tableLayout: "fixed",
                }}>
                    <thead>
                        <tr>
                            {/* ── Corner: diagonal label showing colVar \ rowVar ── */}
                            <th style={{
                                width: 36, height: 36,
                                padding: 0, verticalAlign: "bottom",
                                position: "relative",
                            }}>
                                {/* diagonal line */}
                                <svg width="36" height="36" style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}>
                                    <line x1="0" y1="0" x2="36" y2="36" stroke="#313244" strokeWidth="1" />
                                </svg>
                                {/* col var label — top-right */}
                                <span style={{
                                    position: "absolute", top: 2, right: 3,
                                    fontSize: 9, fontWeight: 700, color: "#89b4fa",
                                    fontFamily: "monospace", lineHeight: 1,
                                }}>{kmap.colLabel}</span>
                                {/* row var label — bottom-left */}
                                <span style={{
                                    position: "absolute", bottom: 2, left: 3,
                                    fontSize: 9, fontWeight: 700, color: "#89b4fa",
                                    fontFamily: "monospace", lineHeight: 1,
                                }}>{kmap.rowLabel}</span>
                            </th>

                            {/* ── Column Gray-code headers ── */}
                            {kmap.colGray.map((cg, ci) => (
                                <th key={ci} style={{
                                    width: CELL, height: 36, padding: 0,
                                    textAlign: "center", verticalAlign: "bottom",
                                }}>
                                    <div style={{
                                        display: "flex", flexDirection: "column",
                                        alignItems: "center", gap: 2, paddingBottom: 4,
                                    }}>
                                        {/* downward arrow on first col header only */}
                                        {ci === 0 && (
                                            <div style={{
                                                fontSize: 9, color: "#45475a",
                                                lineHeight: 1, marginBottom: 1,
                                            }}>↓</div>
                                        )}
                                        <span style={{
                                            fontSize: 10, fontWeight: 700,
                                            color: "#89b4fa", fontFamily: "monospace",
                                            lineHeight: 1,
                                        }}>{cg}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {kmap.cells.map((rowCells, ri) => (
                            <tr key={ri}>
                                {/* ── Row Gray-code header ── */}
                                <td style={{
                                    width: 36, padding: 0,
                                    textAlign: "right", verticalAlign: "middle",
                                    paddingRight: 6,
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700,
                                            color: "#89b4fa", fontFamily: "monospace",
                                        }}>{kmap.rowGray[ri]}</span>
                                        {/* rightward arrow on first row only */}
                                        {ri === 0 && (
                                            <span style={{ fontSize: 9, color: "#45475a" }}>→</span>
                                        )}
                                    </div>
                                </td>

                                {/* ── Cells ── */}
                                {rowCells.map((cell, ci) => {
                                    // Find which groups cover this cell
                                    const cellGroups = groupOverlays.filter(g =>
                                        g.rowSet.has(ri) && g.colSet.has(ci)
                                    );
                                    const topGroup = cellGroups[cellGroups.length - 1];

                                    return (
                                        <td key={ci} style={{
                                            width: CELL, height: CELL,
                                            padding: 0, position: "relative",
                                            border: `1px solid ${topGroup ? topGroup.border : "#2a2a3e"}`,
                                            borderRadius: 4,
                                            background: topGroup
                                                ? topGroup.color
                                                : cell.val === 1
                                                    ? "rgba(166,227,161,0.05)"
                                                    : "transparent",
                                            textAlign: "center", verticalAlign: "middle",
                                            boxSizing: "border-box",
                                        }}>
                                            {/* Main value */}
                                            <div style={{
                                                fontSize: 16, fontFamily: "monospace", fontWeight: 700,
                                                color: cell.val === 1 ? "#a6e3a1" : "#3a3a50",
                                                lineHeight: 1,
                                            }}>{cell.val}</div>
                                            {/* Minterm index */}
                                            <div style={{
                                                position: "absolute", bottom: 2, right: 4,
                                                fontSize: 8, color: "#45475a",
                                                fontFamily: "monospace", lineHeight: 1,
                                            }}>{cell.minterm}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Boolean expression ── */}
            {expressions && (
                <div style={{
                    padding: "8px 10px",
                    background: "#181825",
                    borderRadius: 6,
                    border: "1px solid #2a2a3e",
                }}>
                    <span style={{ fontSize: 10, color: "#6c7086", fontFamily: "monospace" }}>
                        {outputLabels[selectedOutput]}&nbsp;=&nbsp;
                    </span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#cdd6f4", lineHeight: 1.7 }}>
                        {renderExpr(expressions[selectedOutput]?.expr ?? "—")}
                    </span>
                </div>
            )}

            {/* ── Legend ── */}
            {groupOverlays.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {groupOverlays.map((g, i) => (
                        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#45475a" }}>
                            <span style={{
                                display: "inline-block", width: 12, height: 12,
                                background: g.color,
                                border: `1.5px solid ${g.border}`,
                                borderRadius: 3,
                            }} />
                            group {i + 1}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ fontSize: 10, color: "#45475a" }}>
                Gray code · minterm index bottom-right
            </div>
        </div>
    );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
function TruthTablePanel({ type, onClose }) {
    const [filter, setFilter] = useState("");
    const [showExpr, setShowExpr] = useState(true);
    const [activeTab, setActiveTab] = useState("table"); // "table" | "kmap"

    const data = useMemo(() => buildRows(type), [type]);
    if (!data) return null;

    const { inputLabels, outputLabels, rows, inputCount } = data;
    const isLarge = rows.length > 16;
    const kmapSupported = inputCount >= 2 && inputCount <= 4;

    const filtered = useMemo(() =>
        rows.filter(r => matchesFilter(r.ins, filter)),
        [rows, filter]
    );

    const expressions = useMemo(() =>
        generateExpressions(rows, inputLabels, outputLabels),
        [rows, inputLabels, outputLabels]
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

    const tabStyle = (name) => ({
        background: "transparent",
        border: "none",
        borderBottom: activeTab === name ? "2px solid #89b4fa" : "2px solid transparent",
        color: activeTab === name ? "#89b4fa" : "#6c7086",
        cursor: "pointer",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        padding: "6px 10px",
        textTransform: "uppercase",
        transition: "all 0.12s",
    });

    return (
        <div style={{
            position: "absolute", top: 14, right: 14, zIndex: 500,
            background: "#1e1e2e", border: "1px solid #313244",
            borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            minWidth: 200, maxWidth: 440,
            display: "flex", flexDirection: "column",
            userSelect: "none",
            maxHeight: "calc(100vh - 80px)",
            overflow: "hidden",
        }}>
            {/* ── Header ── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px 0", borderBottom: "1px solid #313244", flexShrink: 0,
            }}>
                {/* Left: type info + tabs */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#cdd6f4", letterSpacing: "0.04em" }}>
                            {type}
                        </span>
                        <span style={{ fontSize: 10, color: "#45475a" }}>
                            {inputCount} in · {rows.length} rows
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: 0 }}>
                        <button
                            onClick={() => setActiveTab("table")}
                            style={tabStyle("table")}
                        >Table</button>
                        {kmapSupported && (
                            <button
                                onClick={() => setActiveTab("kmap")}
                                style={tabStyle("kmap")}
                            >K-Map</button>
                        )}
                    </div>
                </div>

                {/* Right: expr toggle + close */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, paddingBottom: 6 }}>
                    {expressions && activeTab === "table" && (
                        <button onClick={() => setShowExpr(v => !v)} style={{
                            background: showExpr ? "rgba(137,180,250,0.12)" : "transparent",
                            border: showExpr ? "1px solid rgba(137,180,250,0.3)" : "1px solid transparent",
                            borderRadius: 5, color: showExpr ? "#89b4fa" : "#6c7086",
                            cursor: "pointer", fontSize: 10, padding: "2px 7px",
                            fontWeight: 600, letterSpacing: "0.04em", transition: "all 0.12s",
                        }}
                        title="Toggle Boolean expressions"
                        >f(x)</button>
                    )}
                    <button onClick={onClose} style={{
                        background: "transparent", border: "none", color: "#6c7086",
                        cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px", borderRadius: 4,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "#cdd6f4"}
                    onMouseLeave={e => e.currentTarget.style.color = "#6c7086"}
                    >✕</button>
                </div>
            </div>

            {/* ── K-Map tab ── */}
            {activeTab === "kmap" && (
                <div style={{ overflowY: "auto", flex: 1 }}>
                    <KMapPanel
                        rows={rows}
                        inputLabels={inputLabels}
                        outputLabels={outputLabels}
                        inputCount={inputCount}
                    />
                </div>
            )}

            {/* ── Table tab ── */}
            {activeTab === "table" && (<>
                {/* Boolean Expressions */}
                {expressions && showExpr && (
                    <div style={{
                        padding: "8px 12px", borderBottom: "1px solid #313244",
                        flexShrink: 0, display: "flex", flexDirection: "column", gap: 5,
                    }}>
                        {expressions.map(({ label, expr }) => (
                            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                                <span style={{
                                    fontSize: 11, fontWeight: 700, color: "#a6e3a1",
                                    fontFamily: "monospace", flexShrink: 0,
                                }}>{label}</span>
                                <span style={{ fontSize: 10, color: "#45475a", flexShrink: 0 }}>=</span>
                                <span style={{
                                    fontSize: 11, fontFamily: "monospace",
                                    color: "#cdd6f4", wordBreak: "break-word", lineHeight: 1.6,
                                }}>{renderExpr(expr)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filter bar */}
                {isLarge && (
                    <div style={{ padding: "7px 10px", borderBottom: "1px solid #313244", flexShrink: 0 }}>
                        <input
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            placeholder={`Filter… e.g. 1_0  (${filtered.length}/${rows.length})`}
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

                {/* Table */}
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

                {/* Footer */}
                <div style={{
                    padding: "5px 12px", borderTop: "1px solid #313244",
                    display: "flex", gap: 12, fontSize: 10, color: "#45475a", flexShrink: 0,
                }}>
                    <span><span style={{ color: "#89b4fa" }}>■</span> in</span>
                    <span><span style={{ color: "#a6e3a1" }}>■</span> out</span>
                    <span style={{ marginLeft: "auto" }}>X̄ = NOT X</span>
                </div>
            </>)}
        </div>
    );
}

export default TruthTablePanel;