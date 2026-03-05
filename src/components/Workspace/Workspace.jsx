import { useState, useRef } from "react";
import '../../styles/workspace.css';
import Node from "../Node";
import Wire from "../Wire";

function Workspace({ nodes, setNodes }) {
    const workspaceRef = useRef(null);
    const grid = 20;

    const [wires, setWires] = useState([]);
    const [activeWire, setActiveWire] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const updateNodePosition = (id, x, y) => {

        const snappedX = Math.round(x / grid) * grid;
        const snappedY = Math.round(y / grid) * grid;

        const clampedX = Math.max(0, snappedX);
        const clampedY = Math.max(0, snappedY);

        setNodes((prev) =>
            prev.map((node) =>
                node.id === id ? { ...node, x: clampedX, y: clampedY } : node
            )
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


    function getPinPosition(node, pin, isOutput) {

        const NODE_WIDTH = 80
        const NODE_HEIGHT = 40

        const spacing = NODE_HEIGHT / (pin.total + 1)
        const y = node.y + spacing * (pin.index + 1)

        const x = isOutput
            ? node.x + NODE_WIDTH
            : node.x

        return { x, y }
    }

    return (

        <div className="workspace" ref={workspaceRef}
            onMouseMove={(e) => {
                const rect = workspaceRef.current.getBoundingClientRect();

                setMousePos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                });

            }}
            onMouseUp={(e) => {

                if (activeWire && e.target.classList.contains("workspace")) {
                    setActiveWire(null);
                }

            }}>

            <svg className="wire-layer">

                {wires.map(wire => {

                    const n1 = nodes.find(n => n.id === wire.from.nodeId);
                    const n2 = nodes.find(n => n.id === wire.to.nodeId);

                    if (!n1 || !n2) return null;

                    const p1 = getPinPosition(n1, wire.from, true)
                    const p2 = getPinPosition(n2, wire.to, false)

                    const x1 = p1.x
                    const y1 = p1.y

                    const x2 = p2.x
                    const y2 = p2.y

                    return (
                        <Wire
                            key={wire.id}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
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
                    workspaceRef={workspaceRef}
                    updateNodePosition={updateNodePosition}
                    onPinClick={handlePinClick}
                />
            ))}

        </div>
    );
}


export default Workspace;