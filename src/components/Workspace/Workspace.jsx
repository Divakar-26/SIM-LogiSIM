// src/components/Workspace/Workspace.jsx

import { useState, useRef, useEffect } from "react";
import '../../styles/workspace.css';
import Node from "../Node";
import Wire from "../Wire";
import { getPinPosition } from "../../utils/pinPosition";
import { propagate } from "./propagate";
import TruthTablePanel from "./TruthTablePanel";
import ClockConfig from "./ClockConfig";
import { useSettings } from "../../configs/SettingsContext";
import { syncClocks, setClockChangeHandler, stopAllClocks } from "../../utils/clockManager";
import { gateColors, gateConfig } from "../../configs/gates";
import { getNodeSize } from "../../utils/nodeSize";
import { customComponentRegistry } from "../../configs/customComponents";

// ── Toolbar button ────────────────────────────────────────────────────────────
function ToolBtn({ active, onClick, title, children }) {
    return (
        <button title={title} onClick={onClick}
            style={{
                width: 34, height: 34,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "rgba(137,180,250,0.15)" : "transparent",
                border: active ? "1px solid rgba(137,180,250,0.5)" : "1px solid transparent",
                borderRadius: 7, color: active ? "#89b4fa" : "#6c7086",
                cursor: "pointer", fontSize: 17, transition: "all 0.12s", flexShrink: 0,
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
        >{children}</button>
    );
}

// ── Ghost node ────────────────────────────────────────────────────────────────
function GhostNode({ type, x, y, width, height }) {
    const isIO = ["SWITCH", "LED", "CLOCK"].includes(type);
    const COLORS = {
        SWITCH: "#1a7a40", LED: "#a01020", CLOCK: "#1a2a3a",
        AND: "#1a5fa0", OR: "#6b2fa0", NOT: "#b85a10",
    };
    const customComp = customComponentRegistry[type];
    const bg = COLORS[type] || gateColors[type] || (customComp ? "#3d2b8e" : "#3d2b8e");
    return (
        <div style={{
            position: "absolute", left: x, top: y, width, height,
            borderRadius: isIO ? "50%" : 6,
            background: bg,
            border: "2px dashed rgba(137,180,250,0.7)",
            opacity: 0.55,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxSizing: "border-box", pointerEvents: "none", userSelect: "none",
        }}>
            {!isIO && (
                <span style={{
                    fontSize: type.length > 6 ? 8 : 11, fontWeight: 800,
                    color: "rgba(255,255,255,0.85)", textTransform: "uppercase",
                    padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: width - 8,
                }}>
                    {type}
                </span>
            )}
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Junction dot is 10×10; all wires should meet at its center regardless of
// which "pin" (input or output) the wire references.
function pinPos(node, pinInfo, isOutput) {
    if (node.type === "JUNCTION") {
        return { x: node.x + 5, y: node.y + 5 };
    }
    return getPinPosition(node, pinInfo, isOutput);
}
function ghostSize(type) {
    const customComp = customComponentRegistry[type];
    const cfg = gateConfig[type] || {
        inputs:  customComp?.inputPinMap?.length  ?? 2,
        outputs: customComp?.outputPinMap?.length ?? 1,
    };
    const { width, height } = getNodeSize(type, cfg.inputs, cfg.outputs);
    return { w: width, h: height };
}

function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function findWireAtWorldPoint(px, py, nodes, wires, wireStyle, zoom) {
    const THRESH = 8 / zoom;
    for (const wire of wires) {
        const n1 = nodes.find(n => n.id === wire.from.nodeId);
        const n2 = nodes.find(n => n.id === wire.to.nodeId);
        if (!n1 || !n2) continue;
        const p1 = pinPos(n1, wire.from, true);
        const p2 = pinPos(n2, wire.to, false);
        const wps = wire.waypoints || [];

        if (wps.length > 0 || wireStyle === "straight") {
            const pts = [p1, ...wps, p2];
            for (let i = 0; i < pts.length - 1; i++) {
                if (distToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < THRESH) return wire;
            }
        } else {
            const dx = p2.x - p1.x;
            const s = Math.max(Math.abs(dx) * 0.6, 60);
            const cx1 = p1.x + s, cy1 = p1.y, cx2 = p2.x - s, cy2 = p2.y;
            let prev = p1;
            for (let i = 1; i <= 18; i++) {
                const t = i / 18, mt = 1 - t;
                const cur = {
                    x: mt*mt*mt*p1.x + 3*mt*mt*t*cx1 + 3*mt*t*t*cx2 + t*t*t*p2.x,
                    y: mt*mt*mt*p1.y + 3*mt*mt*t*cy1 + 3*mt*t*t*cy2 + t*t*t*p2.y,
                };
                if (distToSegment(px, py, prev.x, prev.y, cur.x, cur.y) < THRESH) return wire;
                prev = cur;
            }
        }
    }
    return null;
}

let _wid = 9000;
const wid = () => ++_wid;

// ── Workspace ─────────────────────────────────────────────────────────────────
function Workspace({ nodes, setNodes, wires, setWires, pendingTypes, onPlacePending, onCancelPending }) {
    const workspaceRef  = useRef(null);
    const grid = 20;

    const [tool, setTool]               = useState("select");
    const [activeWire, setActiveWire]   = useState(null);
    const [activeWireWaypoints, setActiveWireWaypoints] = useState([]);
    const [mousePos, setMousePos]       = useState({ x: 0, y: 0 });
    const [camera, setCamera]           = useState({ x: 0, y: 0, zoom: 1 });
    const [isPanning, setIsPanning]     = useState(false);
    const [panStart, setPanStart]       = useState({ x: 0, y: 0 });
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectionBox, setSelectionBox]   = useState(null);
    const [nodeMenu, setNodeMenu]           = useState(null);
    const [truthTableType, setTruthTableType] = useState(null);
    const [clockConfig, setClockConfig]   = useState(null);
    const [ghostWorldPos, setGhostWorldPos] = useState(null);

    const labelInputRef = useRef(null);
    const { settings }  = useSettings();

    // ── propagation ──────────────────────────────────────────────────────────
    useEffect(() => {
        const newNodes = propagate(nodes, wires);
        const changed = newNodes.some((n, i) => n.value !== nodes[i]?.value);
        if (changed) setNodes(newNodes);
    }, [nodes, wires]);

    // ── clock management ─────────────────────────────────────────────────────
    useEffect(() => {
        setClockChangeHandler((nodeId, newValue) => {
            setNodes(prev => {
                const idx = prev.findIndex(n => n.id === nodeId);
                if (idx === -1 || prev[idx].value === newValue) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], value: newValue };
                return next;
            });
        });
        return () => stopAllClocks();
    }, []);

    useEffect(() => { syncClocks(nodes); }, [nodes]);

    // ── coordinate helpers ────────────────────────────────────────────────────
    const screenToWorld = (sx, sy) => ({
        x: (sx - camera.x) / camera.zoom,
        y: (sy - camera.y) / camera.zoom,
    });

    const focusOrigin = () => {
        const rect = workspaceRef.current.getBoundingClientRect();
        setCamera({ x: rect.width / 2, y: rect.height / 2, zoom: 1 });
    };

    const fitAll = () => {
        if (!nodes.length) { focusOrigin(); return; }
        const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
        const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 120;
        const minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + 120;
        const rect = workspaceRef.current.getBoundingClientRect();
        const zoom = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY), 1.5);
        setCamera({
            x: rect.width  / 2 - ((minX + maxX) / 2) * zoom,
            y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
            zoom,
        });
    };

    const cancelWire = () => { setActiveWire(null); setActiveWireWaypoints([]); };

    // ── node position / toggle ────────────────────────────────────────────────
    const updateNodePosition = (id, x, y, action = null, isGroupDrag = false) => {
        const snap = settings.snapToGrid ? grid : 1;
        const snappedX = Math.round(x / snap) * snap;
        const snappedY = Math.round(y / snap) * snap;
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

    const eraseNode = (id) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        setWires(prev => prev.filter(w => w.from.nodeId !== id && w.to.nodeId !== id));
        setSelectedNodes(prev => prev.filter(nid => nid !== id));
    };

    // ── wire handling ─────────────────────────────────────────────────────────
    const handlePinClick = (pin) => {
        if (tool === "erase") return;
        if (!activeWire) {
            if (pin.type === "output") setActiveWire(pin);
            return;
        }
        if (activeWire.type === "output" && pin.type === "input") {
            const already = wires.some(w => w.to.nodeId === pin.nodeId && w.to.index === pin.index);
            if (already) { cancelWire(); return; }
            setWires(prev => [...prev, {
                id: wid(),
                from: { nodeId: activeWire.nodeId, index: activeWire.index, total: activeWire.total },
                to:   { nodeId: pin.nodeId,         index: pin.index,         total: pin.total },
                waypoints: activeWireWaypoints.length > 0 ? [...activeWireWaypoints] : undefined,
            }]);
        }
        cancelWire();
    };

    // ── node context menu ─────────────────────────────────────────────────────
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
        setNodes(prev => [...prev, { ...node, id: wid(), x: node.x + 40, y: node.y + 40 }]);
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
    const handleClockSave = ({ hz, duty }) => {
        setNodes(prev => prev.map(n => n.id === clockConfig.node.id ? { ...n, hz, duty } : n));
        setClockConfig(null);
    };

    // ── keyboard ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => {
            if (document.activeElement.tagName === "INPUT") return;
            if (e.key === "Delete" || e.key === "Backspace") handleDeleteSelected();
            if (e.key === "Escape") {
                cancelWire();
                setNodeMenu(null);
                setClockConfig(null);
                setTool("select");
                onCancelPending?.();
                setGhostWorldPos(null);
            }
            if (e.key === "f" || e.key === "F") fitAll();
            if (e.key === "h" || e.key === "H") focusOrigin();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedNodes, nodes, pendingTypes]);

    // ── cursor ────────────────────────────────────────────────────────────────
    const cursorMap = { select: "default", pan: "grab", erase: "crosshair" };
    const activeCursor = isPanning ? "grabbing" : cursorMap[tool];

    // ── mouse down ────────────────────────────────────────────────────────────
    const handleWorkspaceMouseDown = (e) => {
        const rect = workspaceRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

        if (e.button === 1 || tool === "pan") {
            setIsPanning(true);
            setPanStart({ x: sx - camera.x, y: sy - camera.y });
            return;
        }

        // ── Wire branching: left-click on a wire → insert junction ────────────
        if (e.button === 0 && tool === "select" && !activeWire) {
            const wx = (sx - camera.x) / camera.zoom;
            const wy = (sy - camera.y) / camera.zoom;
            const hitWire = findWireAtWorldPoint(wx, wy, nodes, wires, settings.wireStyle, camera.zoom);
            if (hitWire) {
                e.stopPropagation();
                setNodeMenu(null);
                setSelectedNodes([]);
                const snap = settings.snapToGrid ? grid : 1;
                const jId = wid();
                // Snap the *center* of the junction to the grid, then back-calculate top-left
                const centerX = Math.round(wx / snap) * snap;
                const centerY = Math.round(wy / snap) * snap;
                const jx = centerX - 5;
                const jy = centerY - 5;
                const jNode = { id: jId, type: "JUNCTION", x: jx, y: jy, value: 0, label: "" };
                setNodes(prev => [...prev, jNode]);
                setWires(prev => [
                    ...prev.filter(w => w.id !== hitWire.id),
                    { id: wid(), from: hitWire.from, to:   { nodeId: jId, index: 0, total: 1 }, waypoints: undefined },
                    { id: wid(), from: { nodeId: jId, index: 0, total: 1 }, to: hitWire.to, waypoints: hitWire.waypoints ? [...hitWire.waypoints] : undefined },
                ]);
                setActiveWire({ type: "output", nodeId: jId, index: 0, total: 1 });
                setActiveWireWaypoints([]);
                return;
            }
        }

        if (e.button === 0) {
            cancelWire();
            setNodeMenu(null);
            setClockConfig(null);
            setSelectedNodes([]);
            if (tool === "select")
                setSelectionBox({ startX: sx, startY: sy, endX: sx, endY: sy });
        }
    };

    // ── right-click: add waypoint pivot during wire drawing ───────────────────
    const handleWorkspaceContextMenu = (e) => {
        e.preventDefault();
        if (activeWire) {
            const rect = workspaceRef.current.getBoundingClientRect();
            const wp = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            setActiveWireWaypoints(prev => [...prev, wp]);
        }
    };

    // ── ghost placement ───────────────────────────────────────────────────────
    const handleGhostMouseMove = (e) => {
        const rect = workspaceRef.current.getBoundingClientRect();
        setGhostWorldPos(screenToWorld(e.clientX - rect.left, e.clientY - rect.top));
    };

    const getGhostPositions = () => {
        if (!ghostWorldPos || !pendingTypes?.length) return [];
        const sizes  = pendingTypes.map(t => ghostSize(t));
        const totalH = sizes.reduce((s, sz) => s + sz.h, 0) + (pendingTypes.length - 1) * 12;
        let curY = ghostWorldPos.y - totalH / 2;
        return pendingTypes.map((type, i) => {
            const sz = sizes[i];
            const pos = { type, x: ghostWorldPos.x - sz.w / 2, y: curY, w: sz.w, h: sz.h };
            curY += sz.h + 12;
            return pos;
        });
    };

    const handleGhostPlace = () => {
        if (!ghostWorldPos || !pendingTypes?.length) return;
        const snap   = settings.snapToGrid ? grid : 1;
        const sizes  = pendingTypes.map(t => ghostSize(t));
        const totalH = sizes.reduce((s, sz) => s + sz.h, 0) + (pendingTypes.length - 1) * 12;
        let curY = ghostWorldPos.y - totalH / 2;
        const placements = pendingTypes.map((type, i) => {
            const sz = sizes[i];
            const px = Math.round((ghostWorldPos.x - sz.w / 2) / snap) * snap;
            const py = Math.round(curY / snap) * snap;
            curY += sz.h + 12;
            return { type, x: px, y: py };
        });
        onPlacePending?.(placements);
        setGhostWorldPos(null);
    };

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", height: "100%" }}>

            {/* ── Toolbar ── */}
            {settings.showToolbar && (
                <div style={{
                    position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
                    display: "flex", alignItems: "center", gap: 4,
                    background: "#1a1a2a", border: "1px solid #2a2a3e",
                    borderRadius: 10, padding: "4px 6px", zIndex: 100,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)", userSelect: "none",
                }}>
                    <ToolBtn active={tool === "select"} onClick={() => setTool("select")} title="Select (S)">↖</ToolBtn>
                    <ToolBtn active={tool === "pan"}    onClick={() => setTool("pan")}    title="Pan (P)">✥</ToolBtn>
                    <ToolBtn active={tool === "erase"}  onClick={() => setTool("erase")}  title="Erase (E)">✕</ToolBtn>
                    <div style={{ width: 1, height: 22, background: "#2a2a3e", margin: "0 2px" }} />
                    <ToolBtn active={false} onClick={fitAll} title="Fit all nodes (F)">⛶</ToolBtn>
                </div>
            )}

            {/* ── Focus / Home ── */}
            <button onClick={focusOrigin} title="Focus origin (H)"
                style={{
                    position: "absolute", bottom: 20, right: 20, zIndex: 100,
                    width: 40, height: 40, borderRadius: "50%",
                    background: "#1a1a2a", border: "1px solid #45475a",
                    color: "#89b4fa", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                    transition: "border-color 0.15s, background 0.15s", fontSize: 18,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#25253a"; e.currentTarget.style.borderColor = "#89b4fa"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1a1a2a"; e.currentTarget.style.borderColor = "#45475a"; }}
            >⌖</button>

            {/* ── Truth Table / Clock Config panels ── */}
            {truthTableType && <TruthTablePanel type={truthTableType} onClose={() => setTruthTableType(null)} />}
            {clockConfig && (
                <ClockConfig node={clockConfig.node} x={clockConfig.x} y={clockConfig.y}
                    onSave={handleClockSave} onClose={() => setClockConfig(null)} />
            )}

            {/* ── Canvas ── */}
            <div
                className="workspace"
                ref={workspaceRef}
                style={{ cursor: activeCursor, background: settings.bgColor }}
                onMouseMove={(e) => {
                    const rect = workspaceRef.current.getBoundingClientRect();
                    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
                    if (isPanning) { setCamera(c => ({ ...c, x: sx - panStart.x, y: sy - panStart.y })); return; }
                    if (selectionBox) setSelectionBox(prev => prev ? { ...prev, endX: sx, endY: sy } : null);
                    setMousePos(screenToWorld(sx, sy));
                }}
                onMouseDown={handleWorkspaceMouseDown}
                onContextMenu={handleWorkspaceContextMenu}
                onMouseUp={() => {
                    setIsPanning(false);
                    if (selectionBox) {
                        const box  = selectionBox;
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
                    cancelWire();
                    const rect = workspaceRef.current.getBoundingClientRect();
                    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
                    const zf = e.deltaY > 0
                        ? (1 - 0.1 * settings.zoomSensitivity)
                        : (1 + 0.1 * settings.zoomSensitivity);
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
                    <div className="grid-layer" style={{
                        pointerEvents: "none",
                        backgroundColor: settings.bgColor,
                        backgroundImage: settings.showGrid
                            ? `linear-gradient(${settings.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${settings.gridColor} 1px, transparent 1px)`
                            : "none",
                    }} />

                    <svg className="wire-layer" style={{ pointerEvents: "none" }}>
                        {/* Completed wires */}
                        {wires.map(wire => {
                            const n1 = nodes.find(n => n.id === wire.from.nodeId);
                            const n2 = nodes.find(n => n.id === wire.to.nodeId);
                            if (!n1 || !n2) return null;
                            const p1 = pinPos(n1, wire.from, true);
                            const p2 = pinPos(n2, wire.to, false);
                            return (
                                <Wire key={wire.id}
                                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                    active={n1.value === 1}
                                    waypoints={wire.waypoints || []}
                                />
                            );
                        })}

                        {/* Active wire preview with waypoints */}
                        {activeWire && (() => {
                            const node = nodes.find(n => n.id === activeWire.nodeId);
                            if (!node) return null;
                            const p = pinPos(node, activeWire, true);
                            return (
                                <Wire x1={p.x} y1={p.y} x2={mousePos.x} y2={mousePos.y}
                                    waypoints={activeWireWaypoints} />
                            );
                        })()}

                        {/* Junction dots — at output pins driving multiple wires */}
                        {(() => {
                            const srcMap = {};
                            wires.forEach(w => {
                                const srcNode = nodes.find(n => n.id === w.from.nodeId);
                                if (!srcNode || srcNode.type === "JUNCTION") return;
                                const key = `${w.from.nodeId}:${w.from.index}`;
                                if (!srcMap[key]) {
                                    const pos = pinPos(srcNode, w.from, true);
                                    srcMap[key] = { count: 0, pos, active: srcNode.value === 1 };
                                }
                                srcMap[key].count++;
                            });
                            return Object.values(srcMap)
                                .filter(s => s.count > 1)
                                .map((s, i) => (
                                    <circle key={i} cx={s.pos.x} cy={s.pos.y} r={4}
                                        fill={s.active ? settings.wireActiveColor : settings.wireInactiveColor} />
                                ));
                        })()}

                        {/* Waypoint pivot indicators during active drawing */}
                        {activeWireWaypoints.map((wp, i) => (
                            <g key={`wpv-${i}`}>
                                <circle cx={wp.x} cy={wp.y} r={5} fill="rgba(137,180,250,0.15)" stroke="#89b4fa" strokeWidth="1" />
                                <circle cx={wp.x} cy={wp.y} r={2} fill="#89b4fa" />
                            </g>
                        ))}
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
                            hz={node.hz}
                            duty={node.duty}
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
                            cancelWire={cancelWire}
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

                {/* Status hints */}
                {selectedNodes.length > 1 && !pendingTypes?.length && (
                    <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#1a1a2a", color: "#a6adc8", fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #2a2a3e", pointerEvents: "none" }}>
                        {selectedNodes.length} selected · Del to delete
                    </div>
                )}
                {activeWire && !pendingTypes?.length && (
                    <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#1a1a2a", color: "#6c7086", fontSize: 11, padding: "5px 12px", borderRadius: 6, border: "1px solid #2a2a3e", pointerEvents: "none" }}>
                        Right-click to add pivot{activeWireWaypoints.length > 0 ? ` · ${activeWireWaypoints.length} pivot${activeWireWaypoints.length > 1 ? 's' : ''}` : ''}
                    </div>
                )}

                {/* Node context menu */}
                {nodeMenu && (
                    <div
                        style={{
                            position: "fixed", left: nodeMenu.x, top: nodeMenu.y,
                            background: "#1e1e2e", border: "1px solid #45475a",
                            borderRadius: 8, padding: 6, minWidth: 170,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.5)", zIndex: 2000,
                            display: "flex", flexDirection: "column", gap: 2,
                        }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {nodeMenu.mode === "menu" ? (<>
                            <div style={menuStyles.header}>{nodes.find(n => n.id === nodeMenu.nodeId)?.type}</div>
                            {nodes.find(n => n.id === nodeMenu.nodeId)?.type !== "JUNCTION" && (
                                <div style={menuStyles.item} onMouseDown={handleSetLabel}>
                                    🏷️ {nodes.find(n => n.id === nodeMenu.nodeId)?.label ? "Edit label" : "Add label"}
                                </div>
                            )}
                            {nodes.find(n => n.id === nodeMenu.nodeId)?.type !== "JUNCTION" && (
                                <div style={menuStyles.item} onMouseDown={handleDuplicateNode}>⧉ Duplicate</div>
                            )}
                            {nodes.find(n => n.id === nodeMenu.nodeId)?.type === "CLOCK" && (
                                <div style={menuStyles.item} onMouseDown={() => {
                                    const node = nodes.find(n => n.id === nodeMenu.nodeId);
                                    setClockConfig({ node, x: nodeMenu.x, y: nodeMenu.y });
                                    setNodeMenu(null);
                                }}>⏱ Configure clock</div>
                            )}
                            {(() => {
                                const t = nodes.find(n => n.id === nodeMenu.nodeId)?.type;
                                if (t && !["SWITCH","LED","CLOCK","JUNCTION"].includes(t)) return (
                                    <div style={menuStyles.item} onMouseDown={() => { setTruthTableType(t); setNodeMenu(null); }}>≡ Truth table</div>
                                );
                            })()}
                            <div style={{ height: 1, background: "#313244", margin: "3px 0" }} />
                            <div style={{ ...menuStyles.item, color: "#f38ba8" }} onMouseDown={handleDeleteNode}>🗑️ Delete</div>
                        </>) : (<>
                            <div style={menuStyles.header}>Label</div>
                            <input
                                ref={labelInputRef}
                                value={nodeMenu.labelValue}
                                onChange={e => setNodeMenu(prev => ({ ...prev, labelValue: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") confirmLabel(); if (e.key === "Escape") setNodeMenu(null); }}
                                placeholder="e.g. Input A"
                                style={{ padding: "7px 10px", borderRadius: 5, fontSize: 13, border: "1px solid #45475a", background: "#313244", color: "#cdd6f4", outline: "none", width: "100%", boxSizing: "border-box" }}
                            />
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                <button onMouseDown={() => setNodeMenu(null)} style={menuStyles.btnCancel}>Cancel</button>
                                <button onMouseDown={confirmLabel} style={menuStyles.btnPrimary}>Set</button>
                            </div>
                        </>)}
                    </div>
                )}
            </div>

            {/* ── Ghost placement overlay ── */}
            {pendingTypes?.length > 0 && (
                <>
                    <div
                        style={{ position: "absolute", inset: 0, zIndex: 50, cursor: "crosshair" }}
                        onMouseMove={handleGhostMouseMove}
                        onMouseLeave={() => setGhostWorldPos(null)}
                        onClick={handleGhostPlace}
                        onContextMenu={e => { e.preventDefault(); onCancelPending?.(); setGhostWorldPos(null); }}
                    >
                        {ghostWorldPos && (
                            <div style={{
                                transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
                                transformOrigin: "0 0",
                                position: "absolute",
                                pointerEvents: "none",
                            }}>
                                {getGhostPositions().map((g, i) => (
                                    <GhostNode key={i} type={g.type} x={g.x} y={g.y} width={g.w} height={g.h} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Placement hint */}
                    <div style={{
                        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                        background: "#1a1a2a", color: "#89b4fa", fontSize: 11, fontWeight: 600,
                        padding: "6px 14px", borderRadius: 6,
                        border: "1px solid rgba(137,180,250,0.3)",
                        pointerEvents: "none", zIndex: 51,
                        display: "flex", alignItems: "center", gap: 8,
                    }}>
                        <span style={{ background: "rgba(137,180,250,0.15)", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                            {pendingTypes.length}
                        </span>
                        {pendingTypes.length === 1 ? pendingTypes[0] : `nodes (${pendingTypes.join(", ")})`} · click to place · Esc to cancel
                    </div>
                </>
            )}
        </div>
    );
}

const menuStyles = {
    header:     { padding: "5px 10px", fontSize: 11, color: "#6c7086", borderBottom: "1px solid #313244", marginBottom: 3, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em" },
    item:       { padding: "7px 12px", borderRadius: 5, cursor: "pointer", fontSize: 13, color: "#cdd6f4", userSelect: "none" },
    btnCancel:  { flex: 1, padding: 6, borderRadius: 5, border: "1px solid #45475a", background: "transparent", color: "#cdd6f4", cursor: "pointer", fontSize: 12 },
    btnPrimary: { flex: 1, padding: 6, borderRadius: 5, border: "none", background: "#89b4fa", color: "#1e1e2e", fontWeight: "bold", cursor: "pointer", fontSize: 12 },
};

export default Workspace;