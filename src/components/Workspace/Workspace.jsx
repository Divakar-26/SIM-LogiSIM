import { useState, useRef, useEffect } from "react";
import '../../styles/workspace.css';
import Node from "../Node";
import Wire from "../Wire";
import { getPinPosition } from "../../utils/pinPosition";
import { propagate } from "./propagate";
import TruthTablePanel from "./TruthTablePanel";

// ── Toolbar button ────────────────────────────────────────────────────────────
function ToolBtn({ active, onClick, title, children }) {
    return (
        <button
            title={title}
            onClick={onClick}
            style={{
                width: 34, height: 34,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "rgba(137,180,250,0.15)" : "transparent",
                border: active ? "1px solid rgba(137,180,250,0.5)" : "1px solid transparent",
                borderRadius: 7,
                color: active ? "#89b4fa" : "#6c7086",
                cursor: "pointer",
                fontSize: 17,
                transition: "all 0.12s",
                flexShrink: 0,
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
        >
            {children}
        </button>
    );
}

function Workspace({ nodes, setNodes, wires, setWires }) {
    const workspaceRef = useRef(null);
    const grid = 20;

    const [tool, setTool]           = useState("select"); // "select" | "pan" | "erase"
    const [activeWire, setActiveWire] = useState(null);
    const [mousePos, setMousePos]   = useState({ x: 0, y: 0 });
    const [camera, setCamera]       = useState({ x: 0, y: 0, zoom: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart]   = useState({ x: 0, y: 0 });
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectionBox, setSelectionBox]   = useState(null);

    const [nodeMenu, setNodeMenu]   = useState(null);
    const [truthTableType, setTruthTableType] = useState(null);
    const labelInputRef = useRef(null);

    // ── propagation ──────────────────────────────────────────────────────────
    useEffect(() => {
        const newNodes = propagate(nodes, wires);
        const changed = newNodes.some((n, i) => n.value !== nodes[i]?.value);
        if (changed) setNodes(newNodes);
    }, [nodes, wires]);

    const screenToWorld = (sx, sy) => ({
        x: (sx - camera.x) / camera.zoom,
        y: (sy - camera.y) / camera.zoom,
    });

    // ── focus origin ─────────────────────────────────────────────────────────
    const focusOrigin = () => {
        const rect = workspaceRef.current.getBoundingClientRect();
        setCamera({ x: rect.width / 2, y: rect.height / 2, zoom: 1 });
    };

    // ── fit all nodes ────────────────────────────────────────────────────────
    const fitAll = () => {
        if (!nodes.length) { focusOrigin(); return; }
        const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
        const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 120;
        const minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + 120;
        const rect  = workspaceRef.current.getBoundingClientRect();
        const zoom  = Math.min(rect.width  / (maxX - minX), rect.height / (maxY - minY), 1.5);
        const cx    = rect.width  / 2 - ((minX + maxX) / 2) * zoom;
        const cy    = rect.height / 2 - ((minY + maxY) / 2) * zoom;
        setCamera({ x: cx, y: cy, zoom });
    };

    // ── node position / toggle ───────────────────────────────────────────────
    const updateNodePosition = (id, x, y, action = null, isGroupDrag = false) => {
        const snappedX = Math.round(x / grid) * grid;
        const snappedY = Math.round(y / grid) * grid;
        setNodes(prev => {
            const target = prev.find(n => n.id === id);
            if (!target) return prev;
            if (action === "toggle") return prev.map(n => n.id === id ? { ...n, value: n.value ? 0 : 1 } : n);
            const dx = snappedX - target.x, dy = snappedY - target.y;
            if (dx === 0 && dy === 0) return prev;
            return prev.map(node => {
                if (isGroupDrag && selectedNodes.includes(node.id))
                    return { ...node, x: Math.round((node.x + dx) / grid) * grid, y: Math.round((node.y + dy) / grid) * grid };
                if (node.id === id) return { ...node, x: snappedX, y: snappedY };
                return node;
            });
        });
    };

    // ── erase node on click (erase tool) ────────────────────────────────────
    const eraseNode = (id) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        setWires(prev => prev.filter(w => w.from.nodeId !== id && w.to.nodeId !== id));
        setSelectedNodes(prev => prev.filter(nid => nid !== id));
    };

    // ── wire handling ────────────────────────────────────────────────────────
    const handlePinClick = (pin) => {
        if (tool === "erase") return;
        if (!activeWire) {
            if (pin.type === "output") setActiveWire(pin);
            return;
        }
        if (activeWire.type === "output" && pin.type === "input") {
            const already = wires.some(w => w.to.nodeId === pin.nodeId && w.to.index === pin.index);
            if (already) { setActiveWire(null); return; }
            setWires(prev => [...prev, {
                id: Date.now(),
                from: { nodeId: activeWire.nodeId, index: activeWire.index, total: activeWire.total },
                to:   { nodeId: pin.nodeId,         index: pin.index,         total: pin.total },
            }]);
        }
        setActiveWire(null);
    };

    // ── node context menu ────────────────────────────────────────────────────
    const openNodeMenu = (e, id) => {
        if (tool === "erase") return;
        const node = nodes.find(n => n.id === id);
        setNodeMenu({ nodeId: id, x: e.clientX, y: e.clientY, mode: "menu", labelValue: node?.label || "" });
    };

    const handleDeleteNode = () => {
        const id = nodeMenu.nodeId;
        setNodes(prev => prev.filter(n => n.id !== id));
        setWires(prev => prev.filter(w => w.from.nodeId !== id && w.to.nodeId !== id));
        setSelectedNodes(prev => prev.filter(nid => nid !== id));
        setNodeMenu(null);
    };
    const handleDuplicateNode = () => {
        const node = nodes.find(n => n.id === nodeMenu.nodeId);
        if (!node) { setNodeMenu(null); return; }
        setNodes(prev => [...prev, { ...node, id: Date.now(), x: node.x + 40, y: node.y + 40 }]);
        setNodeMenu(null);
    };
    const handleSetLabel = () => {
        setNodeMenu(prev => ({ ...prev, mode: "label" }));
        setTimeout(() => labelInputRef.current?.focus(), 50);
    };
    const confirmLabel = () => {
        const { nodeId, labelValue } = nodeMenu;
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, label: labelValue.trim() || undefined } : n));
        setNodeMenu(null);
    };
    const handleDeleteSelected = () => {
        if (!selectedNodes.length) return;
        setNodes(prev => prev.filter(n => !selectedNodes.includes(n.id)));
        setWires(prev => prev.filter(w => !selectedNodes.includes(w.from.nodeId) && !selectedNodes.includes(w.to.nodeId)));
        setSelectedNodes([]);
    };

    // ── keyboard ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => {
            if (document.activeElement.tagName === "INPUT") return;
            if (e.key === "Delete" || e.key === "Backspace") handleDeleteSelected();
            if (e.key === "Escape") { setActiveWire(null); setNodeMenu(null); setTool("select"); }
            if (e.key === "f" || e.key === "F") fitAll();
            if (e.key === "h" || e.key === "H") focusOrigin();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedNodes, nodes]);

    // ── cursor based on tool ─────────────────────────────────────────────────
    const cursorMap = { select: "default", pan: "grab", erase: "crosshair" };
    const activeCursor = isPanning ? "grabbing" : cursorMap[tool];

    // ── mouse handlers ───────────────────────────────────────────────────────
    const handleWorkspaceMouseDown = (e) => {
        const rect = workspaceRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

        if (e.button === 1 || tool === "pan") {
            setIsPanning(true);
            setPanStart({ x: sx - camera.x, y: sy - camera.y });
            return;
        }
        if (e.button === 0) {
            setActiveWire(null);
            setNodeMenu(null);
            setSelectedNodes([]);
            if (tool === "select")
                setSelectionBox({ startX: sx, startY: sy, endX: sx, endY: sy });
        }
    };

    // ── render ───────────────────────────────────────────────────────────────
    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

            {/* ── Toolbar ── */}
            <div style={{
                position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
                display: "flex", alignItems: "center", gap: 4,
                background: "#1a1a2a",
                border: "1px solid #2a2a3e",
                borderRadius: 10,
                padding: "4px 6px",
                zIndex: 100,
                boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                userSelect: "none",
            }}>
                <ToolBtn active={tool === "select"} onClick={() => setTool("select")} title="Select (S)">
                    ↖
                </ToolBtn>

                <ToolBtn active={tool === "pan"} onClick={() => setTool("pan")} title="Pan (P)">
                    ✥
                </ToolBtn>

                <ToolBtn active={tool === "erase"} onClick={() => setTool("erase")} title="Erase (E)">
                    ✕
                </ToolBtn>

                {/* Divider */}
                <div style={{ width: 1, height: 22, background: "#2a2a3e", margin: "0 2px" }} />

                {/* Fit-all */}
                <ToolBtn active={false} onClick={fitAll} title="Fit all nodes (F)">
                    ⛶
                </ToolBtn>
            </div>

            {/* ── Focus / Home button — bottom-right, distinct ── */}
            <button
                onClick={focusOrigin}
                title="Focus origin (H)"
                style={{
                    position: "absolute", bottom: 20, right: 20,
                    zIndex: 100,
                    width: 40, height: 40,
                    borderRadius: "50%",
                    background: "#1a1a2a",
                    border: "1px solid #45475a",
                    color: "#89b4fa",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                    transition: "border-color 0.15s, background 0.15s",
                    fontSize: 18,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#25253a"; e.currentTarget.style.borderColor = "#89b4fa"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1a1a2a"; e.currentTarget.style.borderColor = "#45475a"; }}
            >
                ⌖
            </button>

            {/* ── Truth Table Panel ── */}
            {truthTableType && (
                <TruthTablePanel type={truthTableType} onClose={() => setTruthTableType(null)} />
            )}

            {/* ── Canvas ── */}
            <div
                className="workspace"
                ref={workspaceRef}
                style={{ cursor: activeCursor }}
                onMouseMove={(e) => {
                    const rect = workspaceRef.current.getBoundingClientRect();
                    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
                    if (isPanning) { setCamera(c => ({ ...c, x: sx - panStart.x, y: sy - panStart.y })); return; }
                    if (selectionBox) setSelectionBox(prev => prev ? { ...prev, endX: sx, endY: sy } : null);
                    setMousePos(screenToWorld(sx, sy));
                }}
                onMouseDown={handleWorkspaceMouseDown}
                onMouseUp={() => {
                    setIsPanning(false);
                    if (selectionBox) {
                        const box = selectionBox;
                        const minX = Math.min(box.startX, box.endX), maxX = Math.max(box.startX, box.endX);
                        const minY = Math.min(box.startY, box.endY), maxY = Math.max(box.startY, box.endY);
                        if (maxX - minX > 6 && maxY - minY > 6) {
                            const wMin = screenToWorld(minX, minY), wMax = screenToWorld(maxX, maxY);
                            setSelectedNodes(nodes.filter(n => n.x >= wMin.x && n.x <= wMax.x && n.y >= wMin.y && n.y <= wMax.y).map(n => n.id));
                        }
                        setSelectionBox(null);
                    }
                }}
                onWheel={(e) => {
                    e.preventDefault();
                    setActiveWire(null);
                    const rect = workspaceRef.current.getBoundingClientRect();
                    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
                    const zf = e.deltaY > 0 ? 0.9 : 1.1;
                    const newZoom = Math.min(Math.max(camera.zoom * zf, 0.25), 3);
                    const wm = screenToWorld(mx, my);
                    setCamera({ x: mx - wm.x * newZoom, y: my - wm.y * newZoom, zoom: newZoom });
                }}
            >
                <div
                    className="camera-layer"
                    style={{
                        transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
                        transformOrigin: "0 0", position: "absolute", width: "100%", height: "100%",
                        pointerEvents: "none",
                    }}
                >
                    <div className="grid-layer" style={{ pointerEvents: "none" }} />

                    <svg className="wire-layer" style={{ pointerEvents: "none" }}>
                        {wires.map(wire => {
                            const n1 = nodes.find(n => n.id === wire.from.nodeId);
                            const n2 = nodes.find(n => n.id === wire.to.nodeId);
                            if (!n1 || !n2) return null;
                            const p1 = getPinPosition(n1, wire.from, true);
                            const p2 = getPinPosition(n2, wire.to, false);
                            return <Wire key={wire.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} active={n1.value === 1} />;
                        })}
                        {activeWire && (() => {
                            const node = nodes.find(n => n.id === activeWire.nodeId);
                            if (!node) return null;
                            const p = getPinPosition(node, activeWire, true);
                            return <Wire x1={p.x} y1={p.y} x2={mousePos.x} y2={mousePos.y} />;
                        })()}
                    </svg>

                    {nodes.map((node) => (
                        <Node
                            key={node.id}
                            id={node.id}
                            type={node.type}
                            x={node.x}
                            y={node.y}
                            value={node.value}
                            label={node.label}
                            workspaceRef={workspaceRef}
                            updateNodePosition={updateNodePosition}
                            onPinClick={handlePinClick}
                            camera={camera}
                            selected={selectedNodes.includes(node.id)}
                            onSelect={(id) => {
                                if (tool === "erase") { eraseNode(id); return; }
                                setSelectionBox(null);
                                setSelectedNodes([id]);
                            }}
                            cancelWire={() => setActiveWire(null)}
                            onContextMenu={openNodeMenu}
                            eraseMode={tool === "erase"}
                        />
                    ))}
                </div>

                {/* Selection box */}
                {selectionBox && (
                    <div style={{
                        position: "absolute",
                        left:   Math.min(selectionBox.startX, selectionBox.endX),
                        top:    Math.min(selectionBox.startY, selectionBox.endY),
                        width:  Math.abs(selectionBox.endX - selectionBox.startX),
                        height: Math.abs(selectionBox.endY - selectionBox.startY),
                        border: "1px dashed #89b4fa", background: "rgba(137,180,250,0.08)",
                        pointerEvents: "none",
                    }} />
                )}

                {/* Multi-select hint */}
                {selectedNodes.length > 1 && (
                    <div style={{
                        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                        background: "#1a1a2a", color: "#a6adc8", fontSize: "12px",
                        padding: "5px 12px", borderRadius: "6px", border: "1px solid #2a2a3e",
                        pointerEvents: "none",
                    }}>
                        {selectedNodes.length} selected · Del to delete
                    </div>
                )}

                {/* Node context menu */}
                {nodeMenu && (
                    <div
                        style={{
                            position: "fixed", left: nodeMenu.x, top: nodeMenu.y,
                            background: "#1e1e2e", border: "1px solid #45475a",
                            borderRadius: "8px", padding: "6px", minWidth: "170px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.5)", zIndex: 2000,
                            display: "flex", flexDirection: "column", gap: "2px",
                        }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {nodeMenu.mode === "menu" ? (
                            <>
                                <div style={menuStyles.header}>{nodes.find(n => n.id === nodeMenu.nodeId)?.type}</div>
                                <div style={menuStyles.item} onMouseDown={handleSetLabel}>
                                    🏷️ {nodes.find(n => n.id === nodeMenu.nodeId)?.label ? "Edit label" : "Add label"}
                                </div>
                                <div style={menuStyles.item} onMouseDown={handleDuplicateNode}>⧉ Duplicate</div>
                                <div style={menuStyles.item} onMouseDown={() => {
                                    const t = nodes.find(n => n.id === nodeMenu.nodeId)?.type;
                                    if (t && t !== "SWITCH" && t !== "LED") setTruthTableType(t);
                                    setNodeMenu(null);
                                }}>≡ Truth table</div>
                                <div style={{ height: 1, background: "#313244", margin: "3px 0" }} />
                                <div style={{ ...menuStyles.item, color: "#f38ba8" }} onMouseDown={handleDeleteNode}>🗑️ Delete</div>
                            </>
                        ) : (
                            <>
                                <div style={menuStyles.header}>Label</div>
                                <input
                                    ref={labelInputRef}
                                    value={nodeMenu.labelValue}
                                    onChange={e => setNodeMenu(prev => ({ ...prev, labelValue: e.target.value }))}
                                    onKeyDown={e => { if (e.key === "Enter") confirmLabel(); if (e.key === "Escape") setNodeMenu(null); }}
                                    placeholder="e.g. Input A"
                                    style={{ padding: "7px 10px", borderRadius: "5px", fontSize: "13px", border: "1px solid #45475a", background: "#313244", color: "#cdd6f4", outline: "none", width: "100%", boxSizing: "border-box" }}
                                />
                                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                                    <button onMouseDown={() => setNodeMenu(null)} style={menuStyles.btnCancel}>Cancel</button>
                                    <button onMouseDown={confirmLabel} style={menuStyles.btnPrimary}>Set</button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const menuStyles = {
    header:    { padding: "5px 10px", fontSize: "11px", color: "#6c7086", borderBottom: "1px solid #313244", marginBottom: "3px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em" },
    item:      { padding: "7px 12px", borderRadius: "5px", cursor: "pointer", fontSize: "13px", color: "#cdd6f4", userSelect: "none" },
    btnCancel: { flex: 1, padding: "6px", borderRadius: "5px", border: "1px solid #45475a", background: "transparent", color: "#cdd6f4", cursor: "pointer", fontSize: "12px" },
    btnPrimary:{ flex: 1, padding: "6px", borderRadius: "5px", border: "none", background: "#89b4fa", color: "#1e1e2e", fontWeight: "bold", cursor: "pointer", fontSize: "12px" },
};

export default Workspace;