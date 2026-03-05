export const gateConfig = {
  SWITCH: { inputs: 0, outputs: 1 },
  LED: { inputs: 1, outputs: 0 },
  AND: { inputs: 2, outputs: 1 },
  OR: { inputs: 2, outputs: 1 },
  NOT: { inputs: 1, outputs: 1 },
};

export const gateColors = {
  SWITCH: "#2ecc71",
  AND: "#3498db",
  OR: "#9b59b6",
  NOT: "#e67e22",
  LED: "#e74c3c",
};

export const sidebarItems = [
  "SWITCH",
  "LED",
  "AND",
  "OR",
  "NOT"
];