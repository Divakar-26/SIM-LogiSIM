import { useState, useRef } from 'react'
import '../styles/node.css'
import Pin from "./Pin";
import { gateColors, gateConfig } from '../configs/gates';

function Node({ id, type, x, y, value, updateNodePosition, workspaceRef, onPinClick, camera }) {

    const dragStart = useRef({ x: 0, y: 0 });
    const dragging = useRef(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const config = gateConfig[type];

    const handleMouseDown = (e) => {

        if (e.button !== 0) return;

        e.stopPropagation();

        const rect = workspaceRef.current.getBoundingClientRect();

        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        dragStart.current = { x: mouseX, y: mouseY };

        setOffset({
            x: mouseX - x,
            y: mouseY - y
        });

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseUp = () => {

        if (!dragging.current && type === "SWITCH") {
            updateNodePosition(id, x, y, "toggle");
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

        const dist = Math.sqrt(dx * dx + dy * dy);

        // start dragging only after threshold
        if (!dragging.current && dist > 4) {
            dragging.current = true;
        }

        if (!dragging.current) return;

        const newX = mouseX - offset.x;
        const newY = mouseY - offset.y;

        updateNodePosition(id, newX, newY);
    };

    const isIO = type === "SWITCH" || type === "LED";
    const active = value === 1;

    const handleClick = () => {
        if (type !== "SWITCH") return;
        updateNodePosition(id, x, y, "toggle");
    };


    return (
        <div
            className={`node node-${type.toLowerCase()}`}
            onMouseDown={handleMouseDown}
            style={{
                left: x,
                top: y,

                width: isIO ? "28px" : "80px",
                height: isIO ? "28px" : "40px",

                borderRadius: isIO ? "50%" : "4px",

                background: isIO
                    ? active
                        ? "#ff0000"
                        : "#ffb3b3"
                    : gateColors[type],

                border: isIO ? "2px solid black" : "1px solid #555"
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