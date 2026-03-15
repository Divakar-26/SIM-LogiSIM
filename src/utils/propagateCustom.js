// src/utils/propagateCustom.js
// O(1) truth-table lookup — only called for combinational (feedback-free) components.
// Feedback components use evaluateFeedbackComponent() from customComponents.js directly.

import { customComponentRegistry } from "../configs/customComponents";

export function evaluateCustomComponent(name, inputValues) {
  const comp = customComponentRegistry[name];
  if (!comp?.truthTable) return new Array((comp?.outputCount) || 1).fill(0);

  const key = Array.from(
    { length: comp.inputCount },
    (_, i) => inputValues[i] ?? 0
  ).join("");

  return comp.truthTable[key] ?? new Array(comp.outputCount).fill(0);
}