import { useSettings } from "../../configs/SettingsContext";

function Row({ label, hint, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 0" }}>
      <div>
        <div style={{ fontSize: 12, color: "#cdd6f4", fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: "#45475a", marginTop: 1 }}>{hint}</div>}
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
        width: 36, height: 20, borderRadius: 10, cursor: "pointer",
        background: value ? "#89b4fa" : "#313244",
        border: `1px solid ${value ? "#89b4fa" : "#45475a"}`,
        position: "relative", transition: "background 0.15s, border-color 0.15s",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: value ? 17 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: value ? "#1e1e2e" : "#6c7086",
        transition: "left 0.15s",
      }} />
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ position: "relative", width: 28, height: 20 }}>
      <div style={{
        width: 28, height: 20, borderRadius: 4,
        background: value,
        border: "1px solid #45475a",
        cursor: "pointer",
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
        background: "#313244", border: "1px solid #45475a",
        borderRadius: 5, color: "#cdd6f4", fontSize: 11,
        padding: "3px 6px", cursor: "pointer", outline: "none",
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Slider({ value, onChange, min, max, step, format }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 80, accentColor: "#89b4fa" }}
      />
      <span style={{ fontSize: 10, color: "#6c7086", minWidth: 24, textAlign: "right" }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function Section({ title }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "#45475a",
      padding: "12px 0 4px",
      borderTop: "1px solid #313244",
      marginTop: 4,
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
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 4000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e1e2e", border: "1px solid #313244",
          borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          width: 380, maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px 12px", borderBottom: "1px solid #313244", flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#cdd6f4" }}>Settings</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={resetSettings}
              style={{
                background: "transparent", border: "1px solid #45475a",
                borderRadius: 5, color: "#6c7086", cursor: "pointer",
                fontSize: 10, padding: "3px 8px", fontWeight: 600,
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#cdd6f4"}
              onMouseLeave={e => e.currentTarget.style.color = "#6c7086"}
            >Reset</button>
            <button
              onClick={onClose}
              style={{
                background: "transparent", border: "none", color: "#6c7086",
                cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#cdd6f4"}
              onMouseLeave={e => e.currentTarget.style.color = "#6c7086"}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "4px 18px 16px", flex: 1 }}>

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
              options={[{ value: "bezier", label: "Bezier" }, { value: "straight", label: "Straight" }]}
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