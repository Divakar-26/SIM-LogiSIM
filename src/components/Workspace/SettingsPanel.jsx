import { useSettings } from "../../configs/SettingsContext";

function Row({ label, hint, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--primary-fg)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "#ccc", marginTop: 1 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 0, cursor: "pointer",
        background: value ? "var(--primary-light)" : "var(--secondary-bg)",
        border: `3px solid #000`,
        position: "relative", transition: "all 0.15s",
        flexShrink: 0,
        boxShadow: "2px 2px 0 rgba(0,0,0,0.2)",
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: value ? 20 : 2,
        width: 12, height: 12, borderRadius: 0,
        background: value ? "#000" : "var(--secondary-fg)",
        transition: "left 0.15s",
        border: "2px solid #000",
      }} />
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ position: "relative", width: 32, height: 24 }}>
      <div style={{
        width: 32, height: 24, borderRadius: 0,
        background: value, 
        border: "3px solid #000",
        cursor: "pointer",
        boxShadow: "2px 2px 0 rgba(0,0,0,0.2)",
      }} />
      <input
        type="color" 
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          position: "absolute", inset: 0, opacity: 0,
          cursor: "pointer", width: "100%", height: "100%",
        }}
      />
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: "var(--secondary-fg)", border: "3px solid #000",
        borderRadius: 0, color: "#000", fontSize: 12,
        padding: "5px 8px", cursor: "pointer", outline: "none",
        fontWeight: 700, textTransform: "uppercase",
        boxShadow: "2px 2px 0 rgba(0,0,0,0.2)",
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Slider({ value, onChange, min, max, step, format }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 90, accentColor: "var(--primary-light)" }}
      />
      <span style={{ fontSize: 11, color: "var(--primary-fg)", minWidth: 28, textAlign: "right", fontWeight: 700 }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function Section({ title }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 900, textTransform: "uppercase",
      letterSpacing: "0.1em", color: "var(--primary-light)",
      padding: "14px 0 6px",
      borderTop: "2px solid #000",
      marginTop: 6,
    }}>{title}</div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
function SettingsPanel({ onClose }) {
  const { settings, setSettings, resetSettings } = useSettings();
  const set = (key) => (val) => setSettings({ [key]: val });

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 4000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--secondary-bg)", border: "4px solid #000",
          borderRadius: 0, boxShadow: "8px 8px 0 rgba(0,0,0,0.4)",
          width: 420, maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Courier New', monospace",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px 14px", borderBottom: "3px solid #000", flexShrink: 0,
          background: "var(--primary-light)",
        }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: "#000", textTransform: "uppercase", letterSpacing: "0.08em" }}>SETTINGS</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={resetSettings}
              style={{
                background: "var(--secondary-fg)", border: "3px solid #000",
                borderRadius: 0, color: "#000", cursor: "pointer",
                fontSize: 11, padding: "6px 10px", fontWeight: 700,
                textTransform: "uppercase",
                boxShadow: "2px 2px 0 rgba(0,0,0,0.2)",
                transition: "all 0.1s",
              }}
              onMouseEnter={e => {e.target.style.background="var(--primary-dark)"; e.target.style.boxShadow="3px 3px 0 rgba(0,0,0,0.3)"}}
              onMouseLeave={e => {e.target.style.background="var(--secondary-fg)"; e.target.style.boxShadow="2px 2px 0 rgba(0,0,0,0.2)"}}
            >Reset</button>
            <button
              onClick={onClose}
              style={{
                background: "transparent", border: "none", color: "#000",
                cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px",
                fontWeight: 900,
              }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--primary-dark)"}
              onMouseLeave={e => e.currentTarget.style.color = "#000"}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "8px 18px 16px", flex: 1 }}>

          <Section title="Theme" />
          <Row label="Color Palette">
            <Select value={settings.theme} onChange={set("theme")}
              options={[
                { value: "golden", label: "GOLDEN" },
                { value: "purple", label: "PURPLE" },
                { value: "crimson", label: "CRIMSON" },
                { value: "mystique", label: "MYSTIQUE" },
                { value: "sunset", label: "SUNSET" },
                { value: "forest", label: "FOREST" },
              ]}
            />
          </Row>

          <Section title="Interface" />
          <Row label="Show toolbar" hint="Top center tool buttons">
            <Toggle value={settings.showToolbar} onChange={set("showToolbar")} />
          </Row>
          <Row label="Show grid">
            <Toggle value={settings.showGrid} onChange={set("showGrid")} />
          </Row>
          <Row label="Snap to grid">
            <Toggle value={settings.snapToGrid} onChange={set("snapToGrid")} />
          </Row>
          <Row label="Wire style">
            <Select value={settings.wireStyle} onChange={set("wireStyle")}
              options={[{ value: "bezier", label: "BEZIER" }, { value: "straight", label: "STRAIGHT" }]}
            />
          </Row>
          <Row label="Zoom sensitivity">
            <Slider value={settings.zoomSensitivity} onChange={set("zoomSensitivity")}
              min={0.5} max={2.0} step={0.1} format={v => `${v.toFixed(1)}×`}
            />
          </Row>

          <Section title="Wire Colors" />
          <Row label="Active (HIGH)">
            <ColorPicker value={settings.wireActiveColor} onChange={set("wireActiveColor")} />
          </Row>
          <Row label="Inactive (LOW)">
            <ColorPicker value={settings.wireInactiveColor} onChange={set("wireInactiveColor")} />
          </Row>

          <Section title="LED Colors" />
          <Row label="ON">
            <ColorPicker value={settings.ledOnColor} onChange={set("ledOnColor")} />
          </Row>
          <Row label="OFF">
            <ColorPicker value={settings.ledOffColor} onChange={set("ledOffColor")} />
          </Row>

          <Section title="Switch Colors" />
          <Row label="ON">
            <ColorPicker value={settings.switchOnColor} onChange={set("switchOnColor")} />
          </Row>
          <Row label="OFF">
            <ColorPicker value={settings.switchOffColor} onChange={set("switchOffColor")} />
          </Row>

          <Section title="Gate Colors" />
          <Row label="AND">
            <ColorPicker value={settings.gateAndColor} onChange={set("gateAndColor")} />
          </Row>
          <Row label="OR">
            <ColorPicker value={settings.gateOrColor} onChange={set("gateOrColor")} />
          </Row>
          <Row label="NOT">
            <ColorPicker value={settings.gateNotColor} onChange={set("gateNotColor")} />
          </Row>

          <Section title="Canvas" />
          <Row label="Grid color">
            <ColorPicker value={settings.gridColor} onChange={set("gridColor")} />
          </Row>
          <Row label="Background">
            <ColorPicker value={settings.bgColor} onChange={set("bgColor")} />
          </Row>

        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;