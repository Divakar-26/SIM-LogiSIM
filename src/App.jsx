// App.jsx
import { useState, useRef } from 'react'
import Sidebar from './components/Sidebar/Sidebar.jsx'
import Workspace from './components/Workspace/Workspace.jsx'
import { loadSavedComponents, registerComponent, customComponentRegistry } from "./configs/customComponents";
import { SettingsProvider } from "./configs/SettingsContext.js";
import SettingsPanel from "./components/Workspace/SettingsPanel";

loadSavedComponents();

let _uid = 100;
const uid = () => ++_uid;

const makePlayground = (name = "Playground 1") => ({
  id: uid(),
  name,
  dirty: false,
  nodes: [
    { id: uid(), type: "SWITCH", x: 120, y: 200, value: 0, label: "" },
    { id: uid(), type: "LED",    x: 500, y: 200, value: 0, label: "" },
  ],
  wires:   [],
  regions: [],
});

// ── Name Modal ────────────────────────────────────────────────────────────────
function NameModal({ title, defaultValue = "", placeholder, onConfirm, onCancel, confirmLabel = "OK" }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 15, color: "#cdd6f4" }}>{title}</h2>
        <input autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && val.trim()) onConfirm(val.trim()); if (e.key === "Escape") onCancel(); }}
          placeholder={placeholder} style={S.input} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={S.btnCancel}>Cancel</button>
          <button onClick={() => val.trim() && onConfirm(val.trim())} style={S.btnPrimary}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = "Yes", danger = false }) {
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={{ ...S.modal, maxWidth: 320 }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: 0, fontSize: 13, color: "#a6adc8", lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={S.btnCancel}>Cancel</button>
          <button onClick={onConfirm} style={danger ? S.btnDanger : S.btnPrimary}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────
// Rename only via right-click context menu — double-click is intentionally removed.
function TabBar({ tabs, activeId, onSelect, onAdd, onRename, onClose, onMiddleClose, onSettings }) {
  // tabMenu: { tabId, x, y } | null
  const [tabMenu, setTabMenu] = useState(null);

  const closeMenu = () => setTabMenu(null);

  return (
    <>
      <div style={{
        display: "flex", alignItems: "stretch",
        background: "#13131f", borderBottom: "1px solid #252535",
        height: 34, flexShrink: 0, overflowX: "auto", overflowY: "hidden",
      }}
        onClick={closeMenu}
      >
        {tabs.map(tab => {
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              onClick={() => { onSelect(tab.id); closeMenu(); }}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                setTabMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
              onMouseDown={e => { if (e.button === 1) { e.preventDefault(); onMiddleClose(tab.id); } }}
              title="Right-click to rename · Middle-click to close"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "0 10px 0 13px",
                minWidth: 90, maxWidth: 170,
                cursor: "pointer", flexShrink: 0,
                background: active ? "#1e1e2e" : "transparent",
                borderRight: "1px solid #1a1a28",
                borderBottom: active ? "2px solid #89b4fa" : "2px solid transparent",
                userSelect: "none",
              }}
            >
              <span style={{
                flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", fontSize: 11,
                color: active ? "#cdd6f4" : "#585b70",
                fontWeight: active ? 600 : 400,
              }}>
                {tab.dirty ? <span style={{ color: "#f9e2af", marginRight: 2 }}>*</span> : null}
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); closeMenu(); onClose(tab.id); }}
                  style={{ color: "#313244", fontSize: 13, lineHeight: 1, padding: "1px 1px", borderRadius: 3, flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#f38ba8"}
                  onMouseLeave={e => e.currentTarget.style.color = "#313244"}
                >✕</span>
              )}
            </div>
          );
        })}

        <button onClick={() => { onAdd(); closeMenu(); }} title="New playground"
          style={{ background: "transparent", border: "none", color: "#313244", cursor: "pointer", fontSize: 18, padding: "0 10px", lineHeight: 1, flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = "#89b4fa"}
          onMouseLeave={e => e.currentTarget.style.color = "#313244"}
        >+</button>

        <div style={{ flex: 1 }} />

        <button onClick={onSettings} title="Settings"
          style={{ background: "transparent", border: "none", color: "#45475a", cursor: "pointer", fontSize: 15, padding: "0 12px", lineHeight: 1, flexShrink: 0, transition: "color 0.12s" }}
          onMouseEnter={e => e.currentTarget.style.color = "#89b4fa"}
          onMouseLeave={e => e.currentTarget.style.color = "#45475a"}
        >⚙</button>
      </div>

      {/* Tab right-click context menu */}
      {tabMenu && (
        <div
          style={{ ...S.contextMenu, left: tabMenu.x, top: tabMenu.y }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={S.menuItem} onClick={() => {
            const tab = tabs.find(t => t.id === tabMenu.tabId);
            if (tab) onRename(tab.id, tab.name);
            closeMenu();
          }}>✏️ Rename</div>
          {tabs.length > 1 && (
            <div style={{ ...S.menuItem, color: "#f38ba8" }} onClick={() => {
              onClose(tabMenu.tabId); closeMenu();
            }}>✕ Close</div>
          )}
        </div>
      )}
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [tabs, setTabs]         = useState([makePlayground("Playground 1")]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [showSettings, setShowSettings] = useState(false);
  const [savedNames, setSavedNames]     = useState(Object.keys(customComponentRegistry));

  // ── App-level clipboard — shared across all tabs ─────────────────────────
  const clipboardRef = useRef(null);

  // ── Pending placement (ghost placement system) ───────────────────────────
  const [pendingTypes, setPendingTypes] = useState([]);

  const requestPlace = (type) => setPendingTypes(prev => [...prev, type]);

  const handlePlacePending = (placements) => {
    setNodes(prev => [
      ...prev,
      ...placements.map(p => {
        const base = { id: uid(), type: p.type, x: p.x, y: p.y, value: 0, label: "" };
        if (p.type === "CLOCK") return { ...base, hz: 1, duty: 0.5 };
        return base;
      }),
    ]);
    setPendingTypes([]);
  };

  const handleCancelPending = () => setPendingTypes([]);

  // ── Save component modal ─────────────────────────────────────────────────
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName]           = useState("");
  const [saveError, setSaveError]         = useState("");
  const saveInputRef = useRef(null);

  // ── Sidebar component menu ───────────────────────────────────────────────
  const [componentMenu, setComponentMenu] = useState(null);
  const renameRef = useRef(null);

  // ── Generic prompts ──────────────────────────────────────────────────────
  const [namePrompt, setNamePrompt]       = useState(null);
  const [confirmPrompt, setConfirmPrompt] = useState(null);

  const fileInputRef = useRef(null);

  // ── Active tab helpers ───────────────────────────────────────────────────
  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];
  const nodes     = activeTab.nodes;
  const wires     = activeTab.wires;
  const regions   = activeTab.regions ?? [];

  const patchTab = (id, patch) => setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  const setNodes = (updater) => setTabs(prev => prev.map(t =>
    t.id === activeId ? { ...t, dirty: true, nodes: typeof updater === "function" ? updater(t.nodes) : updater } : t
  ));
  const setWires = (updater) => setTabs(prev => prev.map(t =>
    t.id === activeId ? { ...t, dirty: true, wires: typeof updater === "function" ? updater(t.wires) : updater } : t
  ));
  const setRegions = (updater) => setTabs(prev => prev.map(t =>
    t.id === activeId ? { ...t, dirty: true, regions: typeof updater === "function" ? updater(t.regions ?? []) : updater } : t
  ));

  // ── Tab management ───────────────────────────────────────────────────────
  const addTab = () => {
    const tab = makePlayground(`Playground ${tabs.length + 1}`);
    setTabs(prev => [...prev, tab]);
    setActiveId(tab.id);
    setPendingTypes([]);
  };

  const doCloseTab = (id) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeId === id) setActiveId(next[next.length - 1]?.id);
      return next;
    });
  };

  const closeTab = (id) => {
    const tab = tabs.find(t => t.id === id);
    if (tab?.dirty) {
      setConfirmPrompt({
        message: `"${tab.name}" has unsaved changes. Close anyway?`,
        confirmLabel: "Close", danger: true,
        onConfirm: () => { doCloseTab(id); setConfirmPrompt(null); },
      });
    } else {
      doCloseTab(id);
    }
  };

  const renameTab = (id, current) => {
    setNamePrompt({
      title: "Rename playground", defaultValue: current, placeholder: "e.g. 4-bit Adder",
      onConfirm: (val) => { patchTab(id, { name: val }); setNamePrompt(null); },
    });
  };

  // ── Export / Import ──────────────────────────────────────────────────────
  const savePlayground = () => {
    setNamePrompt({
      title: "Export playground", defaultValue: activeTab.name, placeholder: "filename", confirmLabel: "Export",
      onConfirm: (val) => {
        const fname   = val.endsWith(".json") ? val : `${val}.json`;
        const payload = JSON.stringify({ name: val, nodes, wires, regions }, null, 2);
        const url     = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
        Object.assign(document.createElement("a"), { href: url, download: fname }).click();
        URL.revokeObjectURL(url);
        patchTab(activeId, { dirty: false });
        setNamePrompt(null);
      },
    });
  };

  const loadPlayground = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data.nodes) && Array.isArray(data.wires)) {
          const tab = makePlayground(data.name || file.name.replace(".json", ""));
          tab.nodes   = data.nodes;
          tab.wires   = data.wires;
          tab.regions = Array.isArray(data.regions) ? data.regions : [];
          tab.dirty   = false;
          setTabs(prev => [...prev, tab]);
          setActiveId(tab.id);
        }
      } catch { alert("Invalid playground file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Save component ───────────────────────────────────────────────────────
  const saveCircuit = () => {
    const switches = nodes.filter(n => n.type === "SWITCH");
    const leds     = nodes.filter(n => n.type === "LED");
    if (!switches.length || !leds.length) {
      setSaveError("Need at least one SWITCH and one LED.");
      setShowSaveModal(true); return;
    }
    setSaveError(""); setSaveName("");
    setShowSaveModal(true);
    setTimeout(() => saveInputRef.current?.focus(), 50);
  };

  const confirmSave = () => {
    if (!saveName.trim()) { setSaveError("Enter a name."); return; }
    const trimmed  = saveName.trim().toUpperCase().replace(/\s+/g, "_");
    const switches = nodes.filter(n => n.type === "SWITCH");
    const leds     = nodes.filter(n => n.type === "LED");
    registerComponent(trimmed,
      JSON.parse(JSON.stringify(nodes)), JSON.parse(JSON.stringify(wires)),
      switches.map(n => ({ nodeId: n.id, pinIndex: 0 })),
      leds.map(n =>     ({ nodeId: n.id, pinIndex: 0 }))
    );
    setSavedNames(Object.keys(customComponentRegistry));
    setShowSaveModal(false); setSaveName("");
  };

  // ── Sidebar component menu ───────────────────────────────────────────────
  const openComponentMenu = (name, x, y) =>
    setComponentMenu({ name, x, y, mode: "menu", renameValue: name });

  const handleRenameComp = () => {
    setComponentMenu(prev => ({ ...prev, mode: "rename" }));
    setTimeout(() => renameRef.current?.focus(), 50);
  };
  const confirmRenameComp = () => {
    const oldName = componentMenu.name;
    const newName = componentMenu.renameValue.trim().toUpperCase().replace(/\s+/g, "_");
    if (!newName || newName === oldName) { setComponentMenu(null); return; }
    const comp = customComponentRegistry[oldName];
    if (comp) {
      delete customComponentRegistry[oldName];
      customComponentRegistry[newName] = { ...comp, name: newName };
      localStorage.setItem("customComponents", JSON.stringify(customComponentRegistry));
      setTabs(prev => prev.map(t => ({
        ...t, nodes: t.nodes.map(n => n.type === oldName ? { ...n, type: newName } : n)
      })));
      setSavedNames(Object.keys(customComponentRegistry));
    }
    setComponentMenu(null);
  };
  const handleDeleteComp = () => {
    const name = componentMenu.name;
    delete customComponentRegistry[name];
    localStorage.setItem("customComponents", JSON.stringify(customComponentRegistry));
    setTabs(prev => prev.map(t => {
      const ids = new Set(t.nodes.filter(n => n.type === name).map(n => n.id));
      return {
        ...t,
        nodes:   t.nodes.filter(n => n.type !== name),
        wires:   t.wires.filter(w => !ids.has(w.from.nodeId) && !ids.has(w.to.nodeId)),
        regions: (t.regions ?? []).map(r => ({ ...r, nodeIds: r.nodeIds.filter(id => !ids.has(id)) })).filter(r => r.nodeIds.length >= 1),
      };
    }));
    setSavedNames(Object.keys(customComponentRegistry));
    setComponentMenu(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SettingsProvider>
      <div style={{ display: "flex", height: "100vh" }} onClick={() => setComponentMenu(null)}>
        <Sidebar
          onRequestPlace={requestPlace}
          onSaveCircuit={saveCircuit}
          savedNames={savedNames}
          onRenameComponent={openComponentMenu}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TabBar
            tabs={tabs} activeId={activeId}
            onSelect={(id) => { setActiveId(id); setPendingTypes([]); }}
            onAdd={addTab}
            onRename={renameTab}
            onClose={closeTab}
            onMiddleClose={closeTab}
            onSettings={() => setShowSettings(true)}
          />

          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <Workspace
              key={activeId}
              nodes={nodes}   setNodes={setNodes}
              wires={wires}   setWires={setWires}
              regions={regions} setRegions={setRegions}
              pendingTypes={pendingTypes}
              onPlacePending={handlePlacePending}
              onCancelPending={handleCancelPending}
              clipboardRef={clipboardRef}
            />
            <div style={{ position: "absolute", bottom: 20, left: 20, zIndex: 200, display: "flex", gap: 6 }}>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={loadPlayground} />
              <PlayBtn onClick={savePlayground}>↓ Export</PlayBtn>
              <PlayBtn onClick={() => fileInputRef.current?.click()}>↑ Import</PlayBtn>
            </div>
          </div>
        </div>

        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

        {namePrompt && (
          <NameModal
            title={namePrompt.title} defaultValue={namePrompt.defaultValue}
            placeholder={namePrompt.placeholder} confirmLabel={namePrompt.confirmLabel}
            onConfirm={namePrompt.onConfirm} onCancel={() => setNamePrompt(null)}
          />
        )}

        {confirmPrompt && (
          <ConfirmModal
            message={confirmPrompt.message} confirmLabel={confirmPrompt.confirmLabel}
            danger={confirmPrompt.danger} onConfirm={confirmPrompt.onConfirm}
            onCancel={() => setConfirmPrompt(null)}
          />
        )}

        {showSaveModal && (
          <div style={S.overlay}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Save Component</h2>
              {saveError
                ? <p style={{ margin: 0, color: "#f38ba8", fontSize: 13 }}>{saveError}</p>
                : <p style={{ margin: 0, color: "#a6adc8", fontSize: 13 }}>
                    {nodes.filter(n => n.type === "SWITCH").length} input(s) · {nodes.filter(n => n.type === "LED").length} output(s)
                  </p>}
              {!saveError.includes("SWITCH") && (
                <input ref={saveInputRef} value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && confirmSave()}
                  placeholder="e.g. HALF_ADDER" style={S.input} />
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowSaveModal(false)} style={S.btnCancel}>Cancel</button>
                {!saveError.includes("SWITCH") && <button onClick={confirmSave} style={S.btnPrimary}>Save</button>}
              </div>
            </div>
          </div>
        )}

        {componentMenu && (
          <div style={{ ...S.contextMenu, left: componentMenu.x, top: componentMenu.y }} onClick={e => e.stopPropagation()}>
            {componentMenu.mode === "menu" ? (<>
              <div style={S.menuHeader}>📦 {componentMenu.name}</div>
              <div style={S.menuItem} onClick={handleRenameComp}>✏️ Rename</div>
              <div style={{ ...S.menuItem, color: "#f38ba8" }} onClick={handleDeleteComp}>🗑️ Delete</div>
            </>) : (<>
              <div style={S.menuHeader}>Rename</div>
              <input ref={renameRef} value={componentMenu.renameValue}
                onChange={e => setComponentMenu(p => ({ ...p, renameValue: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") confirmRenameComp(); if (e.key === "Escape") setComponentMenu(null); }}
                style={{ ...S.input, marginBottom: 0 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => setComponentMenu(null)} style={{ ...S.btnCancel, flex: 1 }}>Cancel</button>
                <button onClick={confirmRenameComp} style={{ ...S.btnPrimary, flex: 1 }}>OK</button>
              </div>
            </>)}
          </div>
        )}
      </div>
    </SettingsProvider>
  );
}

function PlayBtn({ onClick, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#25253a" : "#1a1a2a", border: "1px solid #2a2a3e",
        borderRadius: 6, color: hov ? "#cdd6f4" : "#6c7086",
        cursor: "pointer", fontSize: 11, fontWeight: 600,
        padding: "5px 10px", letterSpacing: "0.04em", transition: "all 0.12s",
      }}
    >{children}</button>
  );
}

const S = {
  overlay:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 },
  modal:       { background: "#1e1e2e", color: "#cdd6f4", borderRadius: 10, padding: "24px 28px", minWidth: 300, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 12 },
  contextMenu: { position: "fixed", background: "#1e1e2e", border: "1px solid #45475a", borderRadius: 8, padding: 6, minWidth: 160, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", flexDirection: "column", gap: 2 },
  menuHeader:  { padding: "6px 10px", fontSize: 11, color: "#6c7086", borderBottom: "1px solid #313244", marginBottom: 4, fontWeight: "bold" },
  menuItem:    { padding: "8px 12px", borderRadius: 5, cursor: "pointer", fontSize: 13, color: "#cdd6f4", userSelect: "none" },
  input:       { padding: "8px 12px", borderRadius: 6, fontSize: 13, border: "1px solid #45475a", background: "#313244", color: "#cdd6f4", outline: "none", width: "100%", boxSizing: "border-box" },
  btnCancel:   { padding: "7px 16px", borderRadius: 6, border: "1px solid #45475a", background: "transparent", color: "#cdd6f4", cursor: "pointer", fontSize: 13 },
  btnPrimary:  { padding: "7px 16px", borderRadius: 6, border: "none", background: "#89b4fa", color: "#1e1e2e", fontWeight: "bold", cursor: "pointer", fontSize: 13 },
  btnDanger:   { padding: "7px 16px", borderRadius: 6, border: "none", background: "#f38ba8", color: "#1e1e2e", fontWeight: "bold", cursor: "pointer", fontSize: 13 },
};

export default App;