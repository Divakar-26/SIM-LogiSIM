// src/components/Node.jsx

import { useState, useRef } from 'react'
import '../styles/node.css'
import Pin from "./Pin";
import { gateColors, gateConfig, customColor } from '../configs/gates';
import { customComponentRegistry } from "../configs/customComponents";
import { getNodeSize } from "../utils/nodeSize";
import { useSettings } from "../configs/SettingsContext";

// ── Clock face SVG ────────────────────────────────────────────────────────────
// Shown inside the CLOCK node body instead of a text label.
function ClockFace({ active, size }) {
    const r  = size * 0.32;
    const cx = size / 2, cy = size / 2;
    // Mini waveform path inside circle
    const wY = cy;
    const seg = r * 0.38;
    const wPath = [
        `M ${cx - r * 0.7} ${wY}`,
        `L ${cx - r * 0.7} ${wY - seg}`,
        `L ${cx - r * 0.2} ${wY - seg}`,
        `L ${cx - r * 0.2} ${wY + seg}`,
        `L ${cx + r * 0.2} ${wY + seg}`,
        `L ${cx + r * 0.2} ${wY - seg}`,
        `L ${cx + r * 0.7} ${wY - seg}`,
        `L ${cx + r * 0.7} ${wY}`,
    ].join(" ");

    return (
        <svg
            width={size} height={size}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
            {/* outer ring */}
            <circle cx={cx} cy={cy} r={r}
                fill="none"
                stroke={active ? "#a6e3a1" : "rgba(255,255,255,0.25)"}
                strokeWidth="1.5"
            />
            {/* waveform */}
            <path d={wPath}
                fill="none"
                stroke={active ? "#a6e3a1" : "rgba(255,255,255,0.35)"}
                strokeWidth="1.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
            />
            {/* active pulse dot */}
            {active && (
                <circle cx={cx + r * 0.7} cy={wY - seg} r="2.5" fill="#a6e3a1" />
            )}
        </svg>
    );
}

// ── Node ──────────────────────────────────────────────────────────────────────
function Node({ id, type, x, y, value, label, hz, duty, updateNodePosition, workspaceRef, onPinClick, camera, selected, onSelect, onContextMenu, cancelWire, eraseMode }) {
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
            // SWITCH toggles on click; CLOCK does NOT toggle manually
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

    const isClock    = type === "CLOCK";
    const isJunction = type === "JUNCTION";
    const isIO       = type === "SWITCH" || type === "LED" || isClock || isJunction;
    const isSwitch   = type === "SWITCH";
    const active   = value === 1;

    const { settings } = useSettings();
    const { width: nodeWidth, height: nodeHeight } = isJunction
        ? { width: 10, height: 10 }
        : getNodeSize(type, config.inputs, config.outputs);

    let bgColor;
    if (isSwitch) {
        bgColor = active ? settings.switchOnColor : settings.switchOffColor;
    } else if (type === "LED") {
        bgColor = active ? settings.ledOnColor : settings.ledOffColor;
    } else if (isClock) {
        bgColor = active ? "rgba(137,180,250,0.28)" : "#1a2a3a";
    } else if (isJunction) {
        // Junction dot matches wire color
        bgColor = active ? settings.wireActiveColor : settings.wireInactiveColor;
    } else if (type === "AND") {
        bgColor = settings.gateAndColor;
    } else if (type === "OR") {
        bgColor = settings.gateOrColor;
    } else if (type === "NOT") {
        bgColor = settings.gateNotColor;
    } else {
        bgColor = gateColors[type] || customColor(type);
    }

    // ── Border ──────────────────────────────────────────────────────────────
    const borderStyle = isJunction
        ? "none"
        : isClock
            ? `1.5px solid ${active ? "#89b4fa" : "#2a4a6a"}`
            : isIO
                ? "2px solid black"
                : "1px solid #555";

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
                    width:          nodeWidth,
                    height:         nodeHeight,
                    borderRadius:   isIO ? "50%" : "6px",
                    background:     bgColor,
                    border:         borderStyle,
                    outline:        eraseMode && hovered ? "2px solid #f38ba8" : selected ? "2px solid #ffd166" : "none",
                    pointerEvents:  "auto",
                    position:       "relative",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    overflow:       "visible",
                    cursor:         eraseMode ? "crosshair" : isJunction ? "pointer" : "default",
                    transition:     (isClock || isJunction) ? "background 0.08s, border-color 0.08s" : undefined,
                    boxSizing:      "border-box",
                }}
            >
                {/* Input pins — hidden for junction */}
                {!isJunction && Array.from({ length: config.inputs }).map((_, i) => (
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

                {/* ── CLOCK face ── */}
                {isClock && (
                    <ClockFace active={active} size={nodeWidth} />
                )}

                {/* ── Standard gate label (not for IO / clock / junction) ── */}
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

                {/* Output pins — hidden for junction */}
                {!isJunction && Array.from({ length: config.outputs }).map((_, i) => (
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

            {/* ── Node label (user-set) — hidden for junction ── */}
            {label && !isJunction && (
                <div style={{
                    position:      "absolute",
                    whiteSpace:    "nowrap",
                    fontSize:      "11px",
                    fontWeight:    500,
                    color:         "#cdd6f4",
                    pointerEvents: "none",
                    userSelect:    "none",
                    opacity:       hovered ? 1.0 : 0.65,
                    transition:    "opacity 0.15s",
                    ...(isSwitch || isClock ? {
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

            {/* ── Clock: Hz badge below node ── */}
            {isClock && (
                <div style={{
                    position:      "absolute",
                    top:           nodeHeight + 4,
                    left:          "50%",
                    transform:     "translateX(-50%)",
                    fontSize:      9,
                    fontFamily:    "monospace",
                    fontWeight:    700,
                    color:         hovered ? "#89b4fa" : "#45475a",
                    whiteSpace:    "nowrap",
                    pointerEvents: "none",
                    transition:    "color 0.15s",
                }}>
                    {(hz ?? 1) >= 1
                        ? `${hz ?? 1} Hz`
                        : `${(hz ?? 1).toFixed(1)} Hz`}
                </div>
            )}
        </div>
    );
}

export default Node;