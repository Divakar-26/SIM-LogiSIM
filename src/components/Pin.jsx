import "../styles/Pin.css";
import { useState } from "react";

// index/total/nodeHeight passed as numbers so Pin can place itself absolutely
function Pin({ type, index, total, nodeHeight, nodeId, onPinClick, label }) {
    const [hovered, setHovered] = useState(false);

    // Evenly space pins across nodeHeight
    const spacing = nodeHeight / (total + 1);
    const topPx   = spacing * (index + 1);

    const handleStart = (e) => { e.stopPropagation(); if (type === "output") onPinClick({ nodeId, type, index, total }); };
    const handleEnd   = (e) => { e.stopPropagation(); if (type === "input")  onPinClick({ nodeId, type, index, total }); };
 
    return (
        <div
            style={{
                position: "absolute",
                top: topPx,
                [type === "input" ? "left" : "right"]: 0,
                transform: "translate(0, -50%)",
                display: "flex",
                alignItems: "center",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div
                className={`pin pin-${type}`}
                onMouseDown={handleStart}
                onMouseUp={handleEnd}
            />
            {label && (
                <div style={{
                    position: "absolute",
                    ...(type === "input" ? { left: 14 } : { right: 14 }),
                    whiteSpace: "nowrap",
                    fontSize: "10px",
                    fontWeight: 500,
                    color: "#cdd6f4",
                    pointerEvents: "none",
                    userSelect: "none",
                    opacity: hovered ? 1.0 : 0.55,
                    transition: "opacity 0.15s",
                }}>
                    {label}
                </div>
            )}
        </div>
    );
}

export default Pin;