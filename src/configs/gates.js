import { customComponentRegistry } from "./customComponents";

export const gateConfig = {
  SWITCH: { inputs: 0, outputs: 1 },
  LED:    { inputs: 1, outputs: 0 },
  AND:    { inputs: 2, outputs: 1 },
  OR:     { inputs: 2, outputs: 1 },
  NOT:    { inputs: 1, outputs: 1 },
};

// Darker, richer gate colors so white text is clearly legible
export const gateColors = {
  SWITCH: "#1a7a40",  // dark green
  AND:    "#1a5fa0",  // dark blue
  OR:     "#6b2fa0",  // dark purple
  NOT:    "#b85a10",  // dark orange
  LED:    "#a01020",  // dark red
};

// Darker custom component palette — all pass white text contrast
const CUSTOM_COLORS = [
  "#3d2b8e",  // deep violet
  "#0a6e50",  // deep teal
  "#0a5a8a",  // deep blue
  "#8a1a5a",  // deep magenta
  "#7a2a10",  // deep burnt orange
  "#0a6a6a",  // deep cyan
  "#5a3a8e",  // muted indigo
  "#1a6a30",  // deep forest green
];

function customColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return CUSTOM_COLORS[Math.abs(hash) % CUSTOM_COLORS.length];
}

Object.keys(customComponentRegistry).forEach(name => {
    if (!gateColors[name]) gateColors[name] = customColor(name);
});

export { customColor };
export const sidebarItems = ["SWITCH", "LED", "AND", "OR", "NOT"]; 