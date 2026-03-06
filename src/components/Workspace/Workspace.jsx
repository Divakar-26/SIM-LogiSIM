import { useState, useRef, useEffect } from "react";
import '../../styles/workspace.css';
import Node from "../Node";
import Wire from "../Wire";
import { getPinPosition } from "../../utils/pinPosition";
import { propagate } from "./propagate";

function Workspace({ nodes, setNodes, wires, setWires }) {
    const workspaceRef = useRef(null);
    const grid = 20;

    const [activeWire, setActiveWire] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectionBox, setSelectionBox] = useState(null);

    useEffect(() => {
        const newNodes = propagate(nodes, wires);
        const changed = newNodes.some((n, i) => n.value !== nodes[i].value);
        if (changed) setNodes(newNodes);
    }, [nodes, wires]);

    const screenToWorld = (screenX, screenY) => ({
        x: (screenX - camera.x) / camera.zoom,
        y: (screenY - camera.y) / camera.zoom
    });

    const updateNodePosition = (id, x, y, action = null, isGroupDrag = false) => {
        const snappedX = Math.round(x / grid) * grid;
        const snappedY = Math.round(y / grid) * grid;

        setNodes(prev => {
            const target = prev.find(n => n.id === id);
            if (!target) return prev;

            if (action === "toggle") {
                return prev.map(n => n.id === id ? { ...n, value: n.value ? 0 : 1 } : n);
            }

            const dx = snappedX - target.x;
            const dy = snappedY - target.y;
            if (dx === 0 && dy === 0) return prev;

            return prev.map(node => {
                if (isGroupDrag && selectedNodes.includes(node.id)) {
                    return {
                        ...node,
                        x: Math.round((node.x + dx) / grid) * grid,
                        y: Math.round((node.y + dy) / grid) * grid
                    };
                }
                if (node.id === id) return { ...node, x: snappedX, y: snappedY };
                return node;
            });
        });
    };

    const handlePinClick = (pin) => {
        if (!activeWire) {
            if (pin.type === "output") setActiveWire(pin);
            return;
        }
        if (activeWire.type === "output" && pin.type === "input") {
            const alreadyConnected = wires.some(w =>
                w.to.nodeId === pin.nodeId && w.to.index === pin.index
            );
            if (alreadyConnected) { setActiveWire(null); return; }
            setWires(prev => [...prev, {
                id: Date.now(),
                from: { nodeId: activeWire.nodeId, index: activeWire.index, total: activeWire.total },
                to: { nodeId: pin.nodeId, index: pin.index, total: pin.total }
            }]);
        }
        setActiveWire(null);
    };

    return (
        <div
            className="workspace"
            ref={workspaceRef}
            onMouseMove={(e) => {
                const rect = workspaceRef.current.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;

                if (isPanning) {
                    setCamera(c => ({ ...c, x: screenX - panStart.x, y: screenY - panStart.y }));
                    return;
                }

                if (selectionBox) {
                    setSelectionBox(prev => prev ? { ...prev, endX: screenX, endY: screenY } : null);
                }

                setMousePos(screenToWorld(screenX, screenY));
            }}
            onMouseDown={(e) => {
                const rect = workspaceRef.current.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;

                if (e.button === 1) {
                    setIsPanning(true);
                    setPanStart({ x: screenX - camera.x, y: screenY - camera.y });
                    return;
                }

                // This fires for ALL left clicks on workspace AND its children
                // Nodes call e.stopPropagation() so this only runs for background clicks
                if (e.button === 0) {
                    setActiveWire(null); // cancel wire on any background click
                    setSelectedNodes([]);
                    setSelectionBox({ startX: screenX, startY: screenY, endX: screenX, endY: screenY });
                }
            }}
            onMouseUp={(e) => {
                setIsPanning(false);

                if (activeWire) {
                    const tag = e.target.tagName;
                    // cancel wire if clicking on background (not a pin)
                    if (tag !== "DIV" || !e.target.classList.contains("pin")) {
                        // only cancel if not clicking a pin - pins handle themselves
                    }
                }

                if (selectionBox) {
                    const box = selectionBox;
                    const minX = Math.min(box.startX, box.endX);
                    const maxX = Math.max(box.startX, box.endX);
                    const minY = Math.min(box.startY, box.endY);
                    const maxY = Math.max(box.startY, box.endY);

                    // Only do selection if box was big enough (not a stray click)
                    if (maxX - minX > 6 && maxY - minY > 6) {
                        const worldMin = screenToWorld(minX, minY);
                        const worldMax = screenToWorld(maxX, maxY);
                        const selected = nodes
                            .filter(n => n.x >= worldMin.x && n.x <= worldMax.x && n.y >= worldMin.y && n.y <= worldMax.y)
                            .map(n => n.id);
                        setSelectedNodes(selected);
                    }

                    setSelectionBox(null);
                }
            }}
            onWheel={(e) => {
                e.preventDefault();
                setActiveWire(null); // cancel wire on scroll/zoom
                const rect = workspaceRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                const newZoom = Math.min(Math.max(camera.zoom * zoomFactor, 0.5), 2);
                const worldMouse = screenToWorld(mouseX, mouseY);
                setCamera({
                    x: mouseX - worldMouse.x * newZoom,
                    y: mouseY - worldMouse.y * newZoom,
                    zoom: newZoom
                });
            }}
        >
            <div
                className="camera-layer"
                style={{
                    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
                    transformOrigin: "0 0",
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    // KEY: pointer-events none so clicks fall through to workspace div
                    pointerEvents: "none"
                }}
            >
                <div className="grid-layer" style={{ pointerEvents: "none" }}></div>
                <svg className="wire-layer" style={{ pointerEvents: "none" }}>
                    {wires.map(wire => {
                        const n1 = nodes.find(n => n.id === wire.from.nodeId);
                        const n2 = nodes.find(n => n.id === wire.to.nodeId);
                        if (!n1 || !n2) return null;
                        const p1 = getPinPosition(n1, wire.from, true);
                        const p2 = getPinPosition(n2, wire.to, false);
                        const active = n1.value === 1;
                        return <Wire key={wire.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} active={active} />;
                    })}
                    {activeWire && (() => {
                        const node = nodes.find(n => n.id === activeWire.nodeId);
                        if (!node) return null;
                        const p = getPinPosition(node, activeWire, true);
                        return <Wire x1={p.x} y1={p.y} x2={mousePos.x} y2={mousePos.y} />;
                    })()}
                </svg>

                {/* Nodes get pointer-events re-enabled individually */}
                {nodes.map((node) => (
                    <Node
                        key={node.id}
                        id={node.id}
                        type={node.type}
                        x={node.x}
                        y={node.y}
                        value={node.value}
                        workspaceRef={workspaceRef}
                        updateNodePosition={updateNodePosition}
                        onPinClick={handlePinClick}
                        camera={camera}
                        selected={selectedNodes.includes(node.id)}
                        onSelect={(id) => {
                            setSelectionBox(null);
                            setSelectedNodes([id]);
                        }}
                        cancelWire={() => setActiveWire(null)}
                        onContextMenu={(e, id) => {}}
                    />
                ))}
            </div>

            {selectionBox && (
                <div style={{
                    position: "absolute",
                    left: Math.min(selectionBox.startX, selectionBox.endX),
                    top: Math.min(selectionBox.startY, selectionBox.endY),
                    width: Math.abs(selectionBox.endX - selectionBox.startX),
                    height: Math.abs(selectionBox.endY - selectionBox.startY),
                    border: "1px dashed #89b4fa",
                    background: "rgba(137,180,250,0.1)",
                    pointerEvents: "none"
                }} />
            )}
        </div>
    );
}

export default Workspace;