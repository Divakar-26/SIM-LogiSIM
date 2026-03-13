export const customComponentRegistry = {};

// ─── Truth-table builder ──────────────────────────────────────────────────────
// values map: nodeId → scalar for simple gates, array for multi-output customs

function readOutput(values, nodeId, outputIndex) {
  const v = values[nodeId];
  if (Array.isArray(v)) return v[outputIndex] ?? 0;
  return outputIndex === 0 ? (v ?? 0) : 0;
}

function evalNode(type, ins, registry) {
  switch (type) {
    case "AND":    return [(ins[0] && ins[1]) ? 1 : 0];
    case "OR":     return [(ins[0] || ins[1]) ? 1 : 0];
    case "NOT":    return [ins[0] ? 0 : 1];
    case "LED":    return [ins[0] ? 1 : 0];
    case "SWITCH": return [ins[0] ?? 0];
    default: {
      const comp = registry[type];
      if (comp?.truthTable) {
        const key = ins.slice(0, comp.inputCount).join("");
        return comp.truthTable[key] ?? new Array(comp.outputCount).fill(0);
      }
      return [0];
    }
  }
}

function buildTruthTable(nodes, wires, inputPinMap, outputPinMap, registry) {
  const inputCount = inputPinMap.length;
  const table = {};

  // Pre-build incoming wire index: nodeId → wire[]
  const incoming = {};
  nodes.forEach(n => { incoming[n.id] = []; });
  wires.forEach(w => {
    if (!incoming[w.to.nodeId]) incoming[w.to.nodeId] = [];
    incoming[w.to.nodeId].push(w);
  });

  for (let combo = 0; combo < (1 << inputCount); combo++) {
    const inputVec = Array.from({ length: inputCount }, (_, i) =>
      (combo >> (inputCount - 1 - i)) & 1
    );
    const key = inputVec.join("");

    // values: nodeId → output array (index 0 = first output, etc.)
    const values = {};
    nodes.forEach(n => { values[n.id] = [n.value ?? 0]; });

    // Inject SWITCH inputs
    inputPinMap.forEach(({ nodeId }, i) => { values[nodeId] = [inputVec[i]]; });

    // Multi-pass until stable
    for (let pass = 0; pass < 40; pass++) {
      let changed = false;
      nodes.forEach(node => {
        if (node.type === "SWITCH") return;

        const comp = registry[node.type];
        const expectedInputs =
          node.type === "NOT" || node.type === "LED" ? 1
          : comp ? comp.inputCount
          : 2;

        // Gather inputs for this node from connected wires
        const ins = new Array(expectedInputs).fill(0);
        (incoming[node.id] || []).forEach(w => {
          if (w.to.index < expectedInputs) {
            ins[w.to.index] = readOutput(values, w.from.nodeId, w.from.index ?? 0);
          }
        });

        const newOutputs = evalNode(node.type, ins, registry);

        // Check if anything changed
        const old = values[node.id];
        const same = Array.isArray(old) &&
          old.length === newOutputs.length &&
          old.every((v, i) => v === newOutputs[i]);

        if (!same) {
          values[node.id] = newOutputs;
          changed = true;
        }
      });
      if (!changed) break;
    }

    table[key] = outputPinMap.map(({ nodeId }) => readOutput(values, nodeId, 0));
  }

  return table;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function registerComponent(name, nodes, wires, inputPinMap, outputPinMap) {
  const clonedNodes = JSON.parse(JSON.stringify(nodes));
  const clonedWires = JSON.parse(JSON.stringify(wires));

  const sortedInputs = [...inputPinMap].sort((a, b) => {
    const ya = clonedNodes.find(n => n.id === a.nodeId)?.y ?? 0;
    const yb = clonedNodes.find(n => n.id === b.nodeId)?.y ?? 0;
    return ya - yb;
  });
  const sortedOutputs = [...outputPinMap].sort((a, b) => {
    const ya = clonedNodes.find(n => n.id === a.nodeId)?.y ?? 0;
    const yb = clonedNodes.find(n => n.id === b.nodeId)?.y ?? 0;
    return ya - yb;
  });

  const truthTable = buildTruthTable(
    clonedNodes, clonedWires,
    sortedInputs, sortedOutputs,
    customComponentRegistry
  );

  customComponentRegistry[name] = {
    name,
    inputPinMap:  sortedInputs,
    outputPinMap: sortedOutputs,
    inputCount:   sortedInputs.length,
    outputCount:  sortedOutputs.length,
    truthTable,
    nodes: clonedNodes,
    wires: clonedWires,
  };

  localStorage.setItem("customComponents", JSON.stringify(customComponentRegistry));
}

export function loadSavedComponents() {
  const saved = localStorage.getItem("customComponents");
  if (saved) Object.assign(customComponentRegistry, JSON.parse(saved));
}