import { createContext, useContext, useState, createElement } from "react";

export const defaultSettings = {
  showToolbar:        true,
  showGrid:           true,
  snapToGrid:         true,
  enableLOD:          true,
  wireStyle:          "bezier",
  zoomSensitivity:    1.0,
  wireActiveColor:    "#ff4444",
  wireInactiveColor:  "#555e6e",
  ledOnColor:         "#ff0000",
  ledOffColor:        "#a01020",
  switchOnColor:      "#1a7a40",
  switchOffColor:     "#2d4a38",
  gateAndColor:       "#1a5fa0",
  gateOrColor:        "#6b2fa0",
  gateNotColor:       "#b85a10",
  gridColor:          "#2a2a2a",
  bgColor:            "#111111",
  theme:              "golden",
};

const KEY = "logic-sim-settings";

function load() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? { ...defaultSettings, ...JSON.parse(s) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}

export const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setRaw] = useState(load);

  const setSettings = (patch) => setRaw(prev => {
    const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  });

  const resetSettings = () => {
    localStorage.setItem(KEY, JSON.stringify(defaultSettings));
    setRaw({ ...defaultSettings });
  };

  return createElement(
    SettingsContext.Provider,
    { value: { settings, setSettings, resetSettings } },
    children
  );
}
 
export function useSettings() {
  return useContext(SettingsContext); 
} 