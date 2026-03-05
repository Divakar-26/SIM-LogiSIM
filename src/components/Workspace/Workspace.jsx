import { useState, useRef, useEffect } from "react";
import '../../styles/workspace.css';
import Node from "../Node";
import Wire from "../Wire";
import { getPinPosition } from "../../utils/pinPosition";
import { propagate } from "./propagate";


function Workspace({ nodes, setNodes }) {
    const workspaceRef = useRef(null);
    const grid = 20;

    const [wires, setWires] = useState([]);
    const [activeWire, setActiveWire] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    useEffect(() => {

        const newNodes = propagate(nodes, wires);

        const changed = newNodes.some((n, i) => n.value !== nodes[i].value);

        if (changed) {
            setNodes(newNodes);
        }

    }, [nodes, wires]);

    const screenToWorld = (screenX, screenY) => {
        return {
            x: (screenX - camera.x) / camera.zoom,
            y: (screenY - camera.y) / camera.zoom
        };
    };

    const updateNodePosition = (id, x, y, action = null) => {

        const snappedX = Math.round(x / grid) * grid;
        const snappedY = Math.round(y / grid) * grid;


        setNodes((prev) =>
            prev.map((node) => {

                if (node.id !== id) return node;

                if (action === "toggle") {
                    return { ...node, value: node.value ? 0 : 1 };
                }

                const snappedX = Math.round(x / grid) * grid;
                const snappedY = Math.round(y / grid) * grid;

                return { ...node, x: snappedX, y: snappedY };

            })
        );
    };

    const handlePinClick = (pin) => {

        // start wire
        if (!activeWire) {
            if (pin.type === "output") {
                setActiveWire(pin);
            }
            return;
        }

        // finish wire
        if (activeWire.type === "output" && pin.type === "input") {

            // check if input already connected
            const alreadyConnected = wires.some(w =>
                w.to.nodeId === pin.nodeId &&
                w.to.index === pin.index
            );

            if (alreadyConnected) {
                setActiveWire(null);
                return;
            }

            const newWire = {
                id: Date.now(),
                from: {
                    nodeId: activeWire.nodeId,
                    index: activeWire.index,
                    total: activeWire.total
                },
                to: {
                    nodeId: pin.nodeId,
                    index: pin.index,
                    total: pin.total
                }
            };

            setWires(prev => [...prev, newWire]);
        }

        setActiveWire(null);
    };


    return (

        <div className="workspace" ref={workspaceRef}
            onMouseMove={(e) => {

                const rect = workspaceRef.current.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;

                if (isPanning) {
                    setCamera({
                        ...camera,
                        x: screenX - panStart.x,
                        y: screenY - panStart.y
                    });
                    return;
                }

                const world = screenToWorld(screenX, screenY);
                setMousePos(world);
            }}
            onMouseDown={(e) => {

                if (e.button === 1) {

                    const rect = workspaceRef.current.getBoundingClientRect();
                    const screenX = e.clientX - rect.left;
                    const screenY = e.clientY - rect.top;

                    setIsPanning(true);

                    setPanStart({
                        x: screenX - camera.x,
                        y: screenY - camera.y
                    });
                }

            }}
            onMouseUp={(e) => {

                setIsPanning(false);

                if (activeWire && e.target.classList.contains("workspace")) {
                    setActiveWire(null);
                }

            }}

            onWheel={(e) => {

                e.preventDefault();

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
                    height: "100%"
                }}
            >
                <div className="grid-layer"></div>
                <svg className="wire-layer">

                    {wires.map(wire => {

                        const n1 = nodes.find(n => n.id === wire.from.nodeId);
                        const n2 = nodes.find(n => n.id === wire.to.nodeId);

                        if (!n1 || !n2) return null;

                        const p1 = getPinPosition(n1, wire.from, true)
                        const p2 = getPinPosition(n2, wire.to, false)

                        const active = n1.value === 1;

                        return (
                            <Wire
                                key={wire.id}
                                x1={p1.x}
                                y1={p1.y}
                                x2={p2.x}
                                y2={p2.y}
                                active={active}
                            />
                        );
                    })}

                    {activeWire && (() => {

                        const node = nodes.find(n => n.id === activeWire.nodeId);
                        if (!node) return null;

                        const p = getPinPosition(node, activeWire, true);

                        return (
                            <Wire
                                x1={p.x}
                                y1={p.y}
                                x2={mousePos.x}
                                y2={mousePos.y}
                            />
                        );

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
                        workspaceRef={workspaceRef}
                        updateNodePosition={updateNodePosition}
                        onPinClick={handlePinClick}
                        camera={camera}
                    />
                ))}
            </div>
        </div>
    );
}


export default Workspace;