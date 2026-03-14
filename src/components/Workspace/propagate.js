// src/components/Workspace/propagate.js

import { evaluateCustomComponent } from "../../utils/propagateCustom";
import { customComponentRegistry } from "../../configs/customComponents";

export function propagate(nodes, wires) {
  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.id, { ...n }));

  // Build input value map: nodeId → [val at index 0, val at index 1, ...]
  const inputsMap = {};
  wires.forEach(w => {
    const fromNode = nodeMap.get(w.from.nodeId);
    if (!fromNode) return;
    if (!inputsMap[w.to.nodeId]) inputsMap[w.to.nodeId] = [];
    const fromVal = (fromNode.outputs && fromNode.outputs[w.from.index] !== undefined)
      ? fromNode.outputs[w.from.index]
      : fromNode.value;
    inputsMap[w.to.nodeId][w.to.index] = fromVal;
  });

  // Multi-pass to handle chains
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;

    nodeMap.forEach(node => {
      // SWITCH and CLOCK both own their value — skip evaluation
      // SWITCH and CLOCK both own their value — skip evaluation
      if (node.type === "SWITCH" || node.type === "CLOCK") return;

      const customComp = customComponentRegistry[node.type];
      const expectedInputs = node.type === "NOT" ? 1
        : node.type === "LED" ? 1
        : customComp ? customComp.inputPinMap.length
        : 2;

      const inVals = inputsMap[node.id] || [];
      const filled = Array.from({ length: expectedInputs }, (_, i) => inVals[i] ?? 0);

      let newValue   = node.value;
      let newOutputs = node.outputs;

      switch (node.type) {
        case "AND":     newValue = filled[0] && filled[1] ? 1 : 0; break;
        case "OR":      newValue = filled[0] || filled[1] ? 1 : 0; break;
        case "NOT":     newValue = filled[0] ? 0 : 1; break;
        case "LED":     newValue = filled[0] ? 1 : 0; break;
        case "JUNCTION": newValue = filled[0]; break;  // pass-through
        default:
          if (customComp) {
            const outputs = evaluateCustomComponent(node.type, filled);
            newOutputs = outputs;
            newValue   = outputs[0] ?? 0;
          }
      }

      if (newValue !== node.value || JSON.stringify(newOutputs) !== JSON.stringify(node.outputs)) {
        node.value   = newValue;
        node.outputs = newOutputs;
        changed = true;

        wires.forEach(w => {
          if (w.from.nodeId === node.id) {
            if (!inputsMap[w.to.nodeId]) inputsMap[w.to.nodeId] = [];
            const outVal = (newOutputs && newOutputs[w.from.index] !== undefined)
              ? newOutputs[w.from.index]
              : newValue;
            inputsMap[w.to.nodeId][w.to.index] = outVal;
          }
        });
      }
    });

    if (!changed) break;
  }

  return Array.from(nodeMap.values());
}