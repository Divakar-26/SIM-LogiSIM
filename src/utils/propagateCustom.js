import { customComponentRegistry } from "../configs/customComponents";

// O(1) lookup — truth table was baked at save time
export function evaluateCustomComponent(name, inputValues) {
  const comp = customComponentRegistry[name];
  if (!comp?.truthTable) return [];

  const key = Array.from(
    { length: comp.inputCount },
    (_, i) => inputValues[i] ?? 0
  ).join("");

  return comp.truthTable[key] ?? new Array(comp.outputCount).fill(0);
}