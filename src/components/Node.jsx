import { useState, useRef } from 'react'
import '../styles/node.css'
import Pin from "./Pin";
import { gateColors, gateConfig } from '../configs/gates';
import { customComponentRegistry } from "../configs/customComponents";

function Node({ id, type, x, y, value, updateNodePosition, workspaceRef, onPinClick, camera, selected, onSelect, onContextMenu, cancelWire }) {

    const dragStart = useRef({ x: 0, y: 0 });
    const dragging = useRef(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const config = gateConfig[type] || {
        inputs: customComponentRegistry[type]?.inputPinMap?.length || 2,
        outputs: customComponentRegistry[type]?.outputPinMap?.length || 1
    };

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation(); // prevent workspace from starting a selection box

        const rect = workspaceRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        dragStart.current = { x: mouseX, y: mouseY };
        dragging.current = false;

        setOffset({ x: mouseX - x, y: mouseY - y });

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseUp = () => {
        if (!dragging.current) {
            if (type === "SWITCH") updateNodePosition(id, x, y, "toggle");
            onSelect(id);
        }
        dragging.current = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e) => {
        const rect = workspaceRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        const dx = mouseX - dragStart.current.x;
        const dy = mouseY - dragStart.current.y;

        if (!dragging.current && Math.sqrt(dx * dx + dy * dy) > 4) {
            dragging.current = true;
            cancelWire(); // cancel any active wire the moment a drag starts
        }

        if (!dragging.current) return;

        updateNodePosition(id, mouseX - offset.x, mouseY - offset.y, null, selected);
    };

    const isIO = type === "SWITCH" || type === "LED";
    const active = value === 1;
    const textWidth = type.length * 8;
    const nodeWidth = isIO ? 28 : textWidth + 40;
    const nodeHeight = isIO ? 28 : 46;

    return (
        <div
            className={`node node-${type.toLowerCase()} ${selected ? "node-selected" : ""}`}
            onMouseDown={handleMouseDown}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, id); }}
            style={{
                left: x,
                top: y,
                width: nodeWidth,
                height: nodeHeight,
                borderRadius: isIO ? "50%" : "6px",
                background: isIO ? (active ? "#ff0000" : "#ffb3b3") : (gateColors[type] || "#555"),
                border: isIO ? "2px solid black" : "1px solid #555",
                paddingLeft: isIO ? "0px" : "20px",
                paddingRight: isIO ? "0px" : "20px",
                // Re-enable pointer events since camera-layer is pointer-events:none
                pointerEvents: "auto"
            }}
        >
            <div className="pin-column" style={{ pointerEvents: "auto" }}>
                {Array.from({ length: config.inputs }).map((_, i) => (
                    <Pin key={`in-${i}`} type="input" index={i} total={config.inputs} nodeId={id} onPinClick={onPinClick} />
                ))}
            </div>

            {!isIO && type}

            <div className="pin-column" style={{ pointerEvents: "auto" }}>
                {Array.from({ length: config.outputs }).map((_, i) => (
                    <Pin key={`out-${i}`} type="output" index={i} total={config.outputs} nodeId={id} onPinClick={onPinClick} />
                ))}
            </div>
        </div>
    );
}

export default Node;