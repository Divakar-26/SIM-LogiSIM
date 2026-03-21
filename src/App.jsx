// App.jsx
import { useState, useRef, useEffect } from 'react'
import Sidebar from './components/Sidebar/Sidebar.jsx'
import Workspace from './components/Workspace/Workspace.jsx'
import { loadSavedComponents, registerComponent, customComponentRegistry } from "./configs/customComponents";
import { SettingsProvider, useSettings } from "./configs/SettingsContext.js";
import SettingsPanel from "./components/Workspace/SettingsPanel";


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
        <h2 style={{ margin: 0, fontSize: 18, color: "var(--primary-light)", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</h2>
        <input autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && val.trim()) onConfirm(val.trim()); if (e.key === "Escape") onCancel(); }}
          placeholder={placeholder} style={S.input} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={S.btnCancel} onMouseEnter={e => {e.target.style.transform="translate(-2px, -2px)"; e.target.style.boxShadow="6px 6px 0 rgba(0,0,0,0.4)"}} onMouseLeave={e => {e.target.style.transform="none"; e.target.style.boxShadow="4px 4px 0 rgba(0,0,0,0.3)"}}>Cancel</button>
          <button onClick={() => val.trim() && onConfirm(val.trim())} style={S.btnPrimary} onMouseEnter={e => {e.target.style.transform="translate(-2px, -2px)"; e.target.style.boxShadow="6px 6px 0 rgba(0,0,0,0.4)"}} onMouseLeave={e => {e.target.style.transform="none"; e.target.style.boxShadow="4px 4px 0 rgba(0,0,0,0.3)"}}>{confirmLabel}</button>
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
        <p style={{ margin: 0, fontSize: 14, color: "var(--primary-fg)", lineHeight: 1.8 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={S.btnCancel} onMouseEnter={e => {e.target.style.transform="translate(-2px, -2px)"; e.target.style.boxShadow="6px 6px 0 rgba(0,0,0,0.4)"}} onMouseLeave={e => {e.target.style.transform="none"; e.target.style.boxShadow="4px 4px 0 rgba(0,0,0,0.3)"}}>Cancel</button>
          <button onClick={onConfirm} style={danger ? S.btnDanger : S.btnPrimary} onMouseEnter={e => {e.target.style.transform="translate(-2px, -2px)"; e.target.style.boxShadow="6px 6px 0 rgba(0,0,0,0.4)"}} onMouseLeave={e => {e.target.style.transform="none"; e.target.style.boxShadow="4px 4px 0 rgba(0,0,0,0.3)"}}>{confirmLabel}</button>
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
        background: "var(--secondary-bg)", borderBottom: "3px solid #000",
        height: 40, flexShrink: 0, overflowX: "auto", overflowY: "hidden",
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
                padding: "0 12px 0 15px",
                minWidth: 90, maxWidth: 170,
                cursor: "pointer", flexShrink: 0,
                background: active ? "var(--primary-light)" : "var(--primary-bg)",
                borderRight: "2px solid #000",
                borderBottom: active ? "3px solid var(--primary-dark)" : "3px solid transparent",
                userSelect: "none",
                fontWeight: 700,
              }}
            >
              <span style={{
                flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", fontSize: 12,
                color: active ? "#000" : "var(--primary-fg)",
                fontWeight: active ? 900 : 700,
                textTransform: "uppercase",
              }}>
                {tab.dirty ? <span style={{ color: "var(--primary-dark)", marginRight: 2, fontSize: 14 }}>●</span> : null}
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); closeMenu(); onClose(tab.id); }}
                  style={{ color: active ? "#000" : "var(--primary-fg)", fontSize: 14, lineHeight: 1, padding: "1px 1px", borderRadius: 0, flexShrink: 0, cursor: "pointer", fontWeight: 900 }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--primary-dark)"}
                  onMouseLeave={e => e.currentTarget.style.color = active ? "#000" : "var(--primary-fg)"}
                >✕</span>
              )}
            </div>
          );
        })}

        <button onClick={() => { onAdd(); closeMenu(); }} title="New playground"
          style={{ background: "transparent", border: "none", color: "var(--primary-light)", cursor: "pointer", fontSize: 20, padding: "0 12px", lineHeight: 1, flexShrink: 0, fontWeight: 900 }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--primary-dark)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--primary-light)"}
        >+</button>

        <div style={{ flex: 1 }} />

        <button onClick={onSettings} title="Settings"
          style={{ background: "transparent", border: "none", color: "var(--secondary-fg)", cursor: "pointer", fontSize: 16, padding: "0 12px", lineHeight: 1, flexShrink: 0, transition: "color 0.12s", fontWeight: 700 }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--primary-light)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--secondary-fg)"}
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
          }} onMouseEnter={e => {e.target.style.background="var(--primary-dark)"; e.target.style.transform="translate(-2px, -2px)"; e.target.style.boxShadow="3px 3px 0 rgba(0,0,0,0.3)"}} onMouseLeave={e => {e.target.style.background="var(--secondary-fg)"; e.target.style.transform="none"; e.target.style.boxShadow="none"}}>✏️ RENAME</div>
          {tabs.length > 1 && (
            <div style={{ ...S.menuItem, background: "var(--primary-dark)" }} onClick={() => {
              onClose(tabMenu.tabId); closeMenu();
            }} onMouseEnter={e => {e.target.style.background="var(--primary-dark)"; e.target.style.transform="translate(-2px, -2px)"; e.target.style.boxShadow="3px 3px 0 rgba(0,0,0,0.3)"}} onMouseLeave={e => {e.target.style.background="var(--primary-dark)"; e.target.style.transform="none"; e.target.style.boxShadow="none"}}>✕ CLOSE</div>
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
  overlay:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 },
  modal:       { background: "var(--secondary-bg)", color: "var(--primary-fg)", borderRadius: 0, padding: "24px 28px", minWidth: 300, border: "4px solid #000", boxShadow: "8px 8px 0 rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 12, fontFamily: "'Courier New', monospace" },
  contextMenu: { position: "fixed", background: "var(--secondary-bg)", border: "3px solid #000", borderRadius: 0, padding: 8, minWidth: 160, boxShadow: "6px 6px 0 rgba(0,0,0,0.4)", zIndex: 4000, display: "flex", flexDirection: "column", gap: 2, fontFamily: "'Courier New', monospace" },
  menuHeader:  { padding: "8px 10px", fontSize: 12, color: "var(--primary-fg)", borderBottom: "2px solid #000", marginBottom: 4, fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.08em" },
  menuItem:    { padding: "10px 12px", borderRadius: 0, cursor: "pointer", fontSize: 12, color: "#000", userSelect: "none", background: "var(--secondary-fg)", fontWeight: "700", border: "2px solid #000", transition: "all 0.1s", textTransform: "uppercase" },
  input:       { padding: "10px 12px", borderRadius: 0, fontSize: 13, border: "3px solid #000", background: "var(--primary-fg)", color: "#000", outline: "none", width: "100%", boxSizing: "border-box", fontWeight: "700", fontFamily: "'Courier New', monospace" },
  btnCancel:   { padding: "10px 16px", borderRadius: 0, border: "3px solid #000", background: "var(--secondary-fg)", color: "#000", cursor: "pointer", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.08em", boxShadow: "4px 4px 0 rgba(0,0,0,0.3)", transition: "all 0.1s" },
  btnPrimary:  { padding: "10px 16px", borderRadius: 0, border: "3px solid #000", background: "var(--primary-light)", color: "#000", fontWeight: "900", cursor: "pointer", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", boxShadow: "4px 4px 0 rgba(0,0,0,0.3)", transition: "all 0.1s" },
  btnDanger:   { padding: "10px 16px", borderRadius: 0, border: "3px solid #000", background: "var(--primary-dark)", color: "#000", fontWeight: "900", cursor: "pointer", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", boxShadow: "4px 4px 0 rgba(0,0,0,0.3)", transition: "all 0.1s" },
};

// ── Theme Provider ───────────────────────────────────────────────────────────
function ThemeProvider({ children }) {
  const { settings } = useSettings();
  
  useEffect(() => {
    const themeClass = `theme-${settings.theme}`;
    document.documentElement.className = themeClass;
  }, [settings.theme]);
  
  return children;
}

function AppWithTheme() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default AppWithTheme;