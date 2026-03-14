// src/components/Sidebar/Sidebar.jsx

import { useState } from "react";
import "../../styles/sidebar.css";

const FOLDERS = [
    { key: "inputs",     label: "Inputs",     items: ["SWITCH"] },
    { key: "sequential", label: "Sequential", items: ["CLOCK"] },
    { key: "outputs",    label: "Outputs",    items: ["LED"] },
    { key: "gates",      label: "Gates",      items: ["AND", "OR", "NOT"] },
];

function Folder({ label, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="sidebar-folder">
            <div className="sidebar-folder-header" onClick={() => setOpen(o => !o)}>
                <span className="sidebar-folder-arrow">{open ? "▾" : "▸"}</span>
                <span className="sidebar-folder-label">{label}</span>
            </div>
            {open && <div className="sidebar-folder-body">{children}</div>}
        </div>
    );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ onRequestPlace, onSaveCircuit, savedNames = [], onRenameComponent }) {
    return (
        <div className="sidebar">
            <div className="sidebar-scroll">
                {FOLDERS.map(folder => (
                    <Folder key={folder.key} label={folder.label}>
                        {folder.items.map(item => (
                            <div
                                key={item}
                                className="sidebar-item"
                                onClick={() => onRequestPlace(item)}
                                title="Click to pick up · click again to stack · click in workspace to place"
                            >
                                {item === "CLOCK" ? (
                                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
                                            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                                            <line x1="5.5" y1="2.5" x2="5.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                            <line x1="5.5" y1="5.5" x2="8"   y2="7"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                        </svg>
                                        CLOCK
                                    </span>
                                ) : item}
                            </div>
                        ))}
                    </Folder>
                ))}

                {savedNames.length > 0 && (
                    <Folder label="Saved" defaultOpen={true}>
                        {savedNames.map(name => (
                            <div
                                key={name}
                                className="sidebar-item sidebar-item-custom"
                                onClick={() => onRequestPlace(name)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    onRenameComponent && onRenameComponent(name, e.clientX, e.clientY);
                                }}
                                title="Click to pick up · right-click for options"
                            >
                                <span className="sidebar-item-icon">📦</span>
                                <span className="sidebar-item-name">{name}</span>
                                <button
                                    className="sidebar-item-menu-btn"
                                    onClick={(e) => { e.stopPropagation(); onRenameComponent && onRenameComponent(name, e.clientX, e.clientY); }}
                                    title="Options"
                                >⋯</button>
                            </div>
                        ))}
                    </Folder>
                )}
            </div>

            <button className="sidebar-save" onClick={onSaveCircuit}>
                💾 Save Circuit
            </button>
        </div>
    );
}

export default Sidebar;