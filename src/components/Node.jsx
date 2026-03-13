import { useState, useRef } from 'react'
import '../styles/node.css'
import Pin from "./Pin";
import { gateColors, gateConfig, customColor } from '../configs/gates';
import { customComponentRegistry } from "../configs/customComponents";
import { getNodeSize } from "../utils/nodeSize";

function Node({ id, type, x, y, value, label, updateNodePosition, workspaceRef, onPinClick, camera, selected, onSelect, onContextMenu, cancelWire, eraseMode }) {
    const dragStart = useRef({ x: 0, y: 0 });
    const dragging  = useRef(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(false);

    const customComp = customComponentRegistry[type];
    const config = gateConfig[type] || {
        inputs:  customComp?.inputPinMap?.length  || 2,
        outputs: customComp?.outputPinMap?.length || 1,
    };

    const inputPinLabels  = customComp?.inputPinMap?.map(({ nodeId }) =>
        customComp.nodes.find(n => n.id === nodeId)?.label || null) || [];
    const outputPinLabels = customComp?.outputPinMap?.map(({ nodeId }) =>
        customComp.nodes.find(n => n.id === nodeId)?.label || null) || [];

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const rect = workspaceRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top  - camera.y) / camera.zoom;
        dragStart.current = { x: mouseX, y: mouseY };
        dragging.current  = false;
        setOffset({ x: mouseX - x, y: mouseY - y });
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup",   handleMouseUp);
    };

    const handleMouseUp = () => {
        if (!dragging.current) {
            if (type === "SWITCH") updateNodePosition(id, x, y, "toggle");
            onSelect(id);
        }
        dragging.current = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup",   handleMouseUp);
    };

    const handleMouseMove = (e) => {
        const rect = workspaceRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top  - camera.y) / camera.zoom;
        const dx = mouseX - dragStart.current.x;
        const dy = mouseY - dragStart.current.y;
        if (!dragging.current && Math.sqrt(dx*dx + dy*dy) > 4) {
            dragging.current = true;
            cancelWire();
        }
        if (!dragging.current) return;
        updateNodePosition(id, mouseX - offset.x, mouseY - offset.y, null, selected);
    };

    const isIO     = type === "SWITCH" || type === "LED";
    const isSwitch = type === "SWITCH";
    const active   = value === 1;

    const { width: nodeWidth, height: nodeHeight } = getNodeSize(type, config.inputs, config.outputs);

    const bgColor = isIO
        ? (active ? "#ff0000" : "#ffb3b3")
        : (gateColors[type] || customColor(type));

    return (
        <div
            style={{ position: "absolute", left: x, top: y }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div
                className={`node node-${type.toLowerCase()}`}
                onMouseDown={handleMouseDown}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, id); }}
                style={{
                    width:        nodeWidth,
                    height:       nodeHeight,
                    borderRadius: isIO ? "50%" : "6px",
                    background:   bgColor,
                    border:       isIO ? "2px solid black" : "1px solid #555",
                    outline:      eraseMode && hovered ? "2px solid #f38ba8" : selected ? "2px solid #ffd166" : "none",
                    pointerEvents: "auto",
                    position:     "relative",
                    display:      "flex",
                    alignItems:   "center",
                    justifyContent: "center",
                    overflow:     "visible",
                    cursor:       eraseMode ? "crosshair" : "default",
                }}
            >
                {/* Input pins */}
                {Array.from({ length: config.inputs }).map((_, i) => (
                    <Pin
                        key={`in-${i}`}
                        type="input"
                        index={i}
                        total={config.inputs}
                        nodeHeight={nodeHeight}
                        nodeId={id}
                        onPinClick={onPinClick}
                        label={inputPinLabels[i] || null}
                    />
                ))}

                {/* Gate label */}
                {!isIO && (
                    <span style={{
                        fontSize:      type.length > 6 ? 9 : 11,
                        fontWeight:    800,
                        color:         "#ffffff",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        userSelect:    "none",
                        pointerEvents: "none",
                        textAlign:     "center",
                        padding:       "0 14px",
                        whiteSpace:    "nowrap",
                        overflow:      "hidden",
                        textOverflow:  "ellipsis",
                        maxWidth:      nodeWidth - 28,
                        textShadow:    "0 1px 3px rgba(0,0,0,0.8)",
                    }}>
                        {type}
                    </span>
                )}

                {/* Output pins */}
                {Array.from({ length: config.outputs }).map((_, i) => (
                    <Pin
                        key={`out-${i}`}
                        type="output"
                        index={i}
                        total={config.outputs}
                        nodeHeight={nodeHeight}
                        nodeId={id}
                        onPinClick={onPinClick}
                        label={outputPinLabels[i] || null}
                    />
                ))}
            </div>

            {/* Node label */}
            {label && (
                <div style={{
                    position:   "absolute",
                    whiteSpace: "nowrap",
                    fontSize:   "11px",
                    fontWeight: 500,
                    color:      "#cdd6f4",
                    pointerEvents: "none",
                    userSelect: "none",
                    opacity:    hovered ? 1.0 : 0.65,
                    transition: "opacity 0.15s",
                    ...(isSwitch ? {
                        left:      nodeWidth + 8,
                        top:       "50%",
                        transform: "translateY(-50%)",
                    } : type === "LED" ? {
                        right:     nodeWidth + 8,
                        top:       "50%",
                        transform: "translateY(-50%)",
                    } : {
                        top:       nodeHeight + 5,
                        left:      "50%",
                        transform: "translateX(-50%)",
                        fontSize:  "10px",
                    }),
                }}>
                    {label}
                </div>
            )}
        </div>
    );
}

export default Node;