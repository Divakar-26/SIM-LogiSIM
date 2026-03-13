import { useState } from "react";
import "../../styles/sidebar.css";

const FOLDERS = [
    { key: "inputs",  label: "Inputs",  items: ["SWITCH"] },
    { key: "outputs", label: "Outputs", items: ["LED"] },
    { key: "gates",   label: "Gates",   items: ["AND", "OR", "NOT"] },
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

function Sidebar({ addNode, onSaveCircuit, savedNames = [], onRenameComponent }) {
    return (
        <div className="sidebar">
            <div className="sidebar-scroll">
                {FOLDERS.map(folder => (
                    <Folder key={folder.key} label={folder.label}>
                        {folder.items.map(item => (
                            <div
                                key={item}
                                className="sidebar-item"
                                onClick={() => addNode(item)}
                            >
                                {item}
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
                                onClick={() => addNode(name)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    onRenameComponent && onRenameComponent(name, e.clientX, e.clientY);
                                }}
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