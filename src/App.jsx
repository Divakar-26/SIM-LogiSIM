import { useState, useRef } from 'react'
import Sidebar from './components/Sidebar/Sidebar.jsx'
import Workspace from './components/Workspace/Workspace.jsx'
import { loadSavedComponents, registerComponent, customComponentRegistry } from "./configs/customComponents";

loadSavedComponents();

function App() {

  const [nodes, setNodes] = useState([
    { id: 1, type: "SWITCH", x: 120, y: 200, value: 1 },
    { id: 3, type: "LED", x: 600, y: 200, value: 0 },
  ]);
  const [wires, setWires] = useState([]);

  const [savedNames, setSavedNames] = useState(Object.keys(customComponentRegistry));

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState("");
  const inputRef = useRef(null);

  const [componentMenu, setComponentMenu] = useState(null);
  // { name, x, y, mode: "menu" | "rename" }
  const renameRef = useRef(null);

  const saveCircuit = () => {
    const switches = nodes.filter(n => n.type === "SWITCH");
    const leds = nodes.filter(n => n.type === "LED");
    if (!switches.length || !leds.length) {
      setSaveError("Need at least one SWITCH and one LED in the circuit.");
      setShowSaveModal(true);
      return;
    }
    setSaveError("");
    setSaveName("");
    setShowSaveModal(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const confirmSave = () => {
    if (!saveName.trim()) { setSaveError("Enter a name."); return; }
    const trimmed = saveName.trim().toUpperCase().replace(/\s+/g, "_");
    const switches = nodes.filter(n => n.type === "SWITCH");
    const leds = nodes.filter(n => n.type === "LED");
    registerComponent(
      trimmed,
      JSON.parse(JSON.stringify(nodes)),
      JSON.parse(JSON.stringify(wires)),
      switches.map(n => ({ nodeId: n.id, pinIndex: 0 })),
      leds.map(n => ({ nodeId: n.id, pinIndex: 0 }))
    );
    setSavedNames(Object.keys(customComponentRegistry));
    setShowSaveModal(false);
    setSaveName("");
  };

  const addNode = (type) => {
    setNodes(prev => [...prev, { id: Date.now(), type, x: 200, y: 200, value: 0 }]);
  };

  // Open context menu for a saved component
  const openComponentMenu = (name, x, y) => {
    setComponentMenu({ name, x, y, mode: "menu", renameValue: name });
  };

  const handleRename = () => {
    setComponentMenu(prev => ({ ...prev, mode: "rename" }));
    setTimeout(() => renameRef.current?.focus(), 50);
  };

  const confirmRename = () => {
    const oldName = componentMenu.name;
    const newName = componentMenu.renameValue.trim().toUpperCase().replace(/\s+/g, "_");
    if (!newName || newName === oldName) { setComponentMenu(null); return; }

    const comp = customComponentRegistry[oldName];
    if (comp) {
      delete customComponentRegistry[oldName];
      customComponentRegistry[newName] = { ...comp, name: newName };
      localStorage.setItem("customComponents", JSON.stringify(customComponentRegistry));

      setNodes(prev => prev.map(n => n.type === oldName ? { ...n, type: newName } : n));
      setSavedNames(Object.keys(customComponentRegistry));
    }
    setComponentMenu(null);
  };

  const handleDelete = () => {
    const name = componentMenu.name;
    delete customComponentRegistry[name];
    localStorage.setItem("customComponents", JSON.stringify(customComponentRegistry));

    const deletedNodeIds = new Set(nodes.filter(n => n.type === name).map(n => n.id));
    setNodes(prev => prev.filter(n => n.type !== name));
    setWires(prev => prev.filter(w => !deletedNodeIds.has(w.from.nodeId) && !deletedNodeIds.has(w.to.nodeId)));
    setSavedNames(Object.keys(customComponentRegistry));
    setComponentMenu(null);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }} onClick={() => setComponentMenu(null)}>
      <Sidebar
        addNode={addNode}
        onSaveCircuit={saveCircuit}
        savedNames={savedNames}
        onRenameComponent={openComponentMenu}
      />
      <Workspace nodes={nodes} setNodes={setNodes} wires={wires} setWires={setWires} />

      {}
      {showSaveModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={{ margin: 0, fontSize: "18px" }}>Save Component</h2>
            {saveError
              ? <p style={{ margin: 0, color: "#f38ba8", fontSize: "13px" }}>{saveError}</p>
              : <p style={{ margin: 0, color: "#a6adc8", fontSize: "13px" }}>
                  {nodes.filter(n => n.type === "SWITCH").length} input(s) · {nodes.filter(n => n.type === "LED").length} output(s)
                </p>
            }
            {!saveError.includes("SWITCH") && (
              <input
                ref={inputRef}
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmSave()}
                placeholder="e.g. HALF_ADDER"
                style={styles.input}
              />
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowSaveModal(false)} style={styles.btnCancel}>Cancel</button>
              {!saveError.includes("SWITCH") && (
                <button onClick={confirmSave} style={styles.btnPrimary}>Save</button>
              )}
            </div>
          </div>
        </div>
      )}

      {}
      {componentMenu && (
        <div
          style={{ ...styles.contextMenu, left: componentMenu.x, top: componentMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {componentMenu.mode === "menu" ? (
            <>
              <div style={styles.menuHeader}>📦 {componentMenu.name}</div>
              <div style={styles.menuItem} onClick={handleRename}>✏️ Rename</div>
              <div style={{ ...styles.menuItem, color: "#f38ba8" }} onClick={handleDelete}>🗑️ Delete</div>
            </>
          ) : (
            <>
              <div style={styles.menuHeader}>Rename Component</div>
              <input
                ref={renameRef}
                value={componentMenu.renameValue}
                onChange={e => setComponentMenu(prev => ({ ...prev, renameValue: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setComponentMenu(null); }}
                style={{ ...styles.input, marginBottom: 0 }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={() => setComponentMenu(null)} style={{ ...styles.btnCancel, flex: 1 }}>Cancel</button>
                <button onClick={confirmRename} style={{ ...styles.btnPrimary, flex: 1 }}>Rename</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
  },
  modal: {
    background: "#1e1e2e", color: "#cdd6f4", borderRadius: "10px",
    padding: "28px 32px", minWidth: "300px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    display: "flex", flexDirection: "column", gap: "12px"
  },
  contextMenu: {
    position: "fixed", background: "#1e1e2e", border: "1px solid #45475a",
    borderRadius: "8px", padding: "6px", minWidth: "180px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)", zIndex: 2000,
    display: "flex", flexDirection: "column", gap: "2px"
  },
  menuHeader: {
    padding: "6px 10px", fontSize: "11px", color: "#6c7086",
    borderBottom: "1px solid #313244", marginBottom: "4px", fontWeight: "bold"
  },
  menuItem: {
    padding: "8px 12px", borderRadius: "5px", cursor: "pointer",
    fontSize: "13px", color: "#cdd6f4",
    transition: "background 0.1s",
    userSelect: "none"
  },
  input: {
    padding: "8px 12px", borderRadius: "6px", fontSize: "14px",
    border: "1px solid #45475a", background: "#313244", color: "#cdd6f4",
    outline: "none", width: "100%", boxSizing: "border-box"
  },
  btnCancel: {
    padding: "7px 16px", borderRadius: "6px", border: "1px solid #45475a",
    background: "transparent", color: "#cdd6f4", cursor: "pointer"
  },
  btnPrimary: {
    padding: "7px 16px", borderRadius: "6px", border: "none",
    background: "#89b4fa", color: "#1e1e2e", fontWeight: "bold", cursor: "pointer"
  }
};

export default App; 