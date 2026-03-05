import { useState } from 'react'
import '../styles/node.css'
import Pin from "./Pin";
import { gateColors, gateConfig } from '../configs/gates';

function Node({ id, type, x, y, updateNodePosition, workspaceRef, onPinClick}) {

    const [dragging, setDragging] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const config = gateConfig[type];

    const handleMouseDown = (e) => {

        const rect = workspaceRef.current.getBoundingClientRect();

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setOffset({
            x: mouseX - x,
            y: mouseY - y
        });

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseUp = () => {
        setDragging(false);

        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    }

    const handleMouseMove = (e) => {
        const rect = workspaceRef.current.getBoundingClientRect();

        let mouseX = e.clientX - rect.left;
        let mouseY = e.clientY - rect.top;

        const newX = mouseX - offset.x;
        const newY = mouseY - offset.y;

        updateNodePosition(id, newX, newY);
    };

    return (
        <div
            className={`node node-${type.toLowerCase()}`}
            onMouseDown={handleMouseDown}
            style={{
                left: x,
                top: y
            }}
        >
            <div className="pin-column">
                {Array.from({ length: config.inputs }).map((_, i) => (
                    <Pin key={`in-${i}`} type="input" index={i} total={config.inputs} nodeId={id} onPinClick={onPinClick}/>
                ))}
            </div>

            {type}

            <div className="pin-column">
                {Array.from({ length: config.outputs }).map((_, i) => (
                    <Pin key={`out-${i}`} type="output" index={i} total={config.outputs} nodeId={id} onPinClick={onPinClick} />
                ))}
            </div>
        </div>
    );
}

export default Node;