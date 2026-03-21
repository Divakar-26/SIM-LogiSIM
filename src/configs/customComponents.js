// src/configs/customComponents.js

export const customComponentRegistry = {};

// ── Utilities ────────────────────────────────────────────────────────────────
function arrEq(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function readOutput(values, nodeId, outputIndex) {
  const v = values[nodeId];
  if (Array.isArray(v)) return v[outputIndex] ?? 0;
  return outputIndex === 0 ? (v ?? 0) : 0;
}

// ── Topological sort (Kahn) ──────────────────────────────────────────────────
function topoSort(nodeArray, wires) {
  const inDeg = new Map(), adj = new Map();
  nodeArray.forEach(n => { inDeg.set(n.id, 0); adj.set(n.id, []); });
  const seen = new Set();
  wires.forEach(w => {
    if (!adj.has(w.from.nodeId) || !inDeg.has(w.to.nodeId)) return;
    const k = `${w.from.nodeId}→${w.to.nodeId}`;
    if (seen.has(k)) return; seen.add(k);
    adj.get(w.from.nodeId).push(w.to.nodeId);
    inDeg.set(w.to.nodeId, inDeg.get(w.to.nodeId) + 1);
  });
  const queue = []; inDeg.forEach((d, id) => { if (d === 0) queue.push(id); });
  const sorted = [];
  while (queue.length) {
    const id = queue.shift(); sorted.push(id);
    for (const nid of adj.get(id)) {
      const d = inDeg.get(nid) - 1; inDeg.set(nid, d);
      if (d === 0) queue.push(nid);
    }
  }
  const s = new Set(sorted);
  nodeArray.forEach(n => { if (!s.has(n.id)) sorted.push(n.id); });
  const byId = new Map(nodeArray.map(n => [n.id, n]));
  return sorted.map(id => byId.get(id)).filter(Boolean);
}

// ── Feedback detection ───────────────────────────────────────────────────────
// Returns true if:
//   (a) there is a direct wire cycle in this circuit, OR
//   (b) ANY node is itself a feedback (sequential) component.
// This means a 4-bit register containing D-latches is correctly flagged.
function hasFeedbackCircuit(nodes, wires, registry) {
  // (b) — contains nested feedback component?
  for (const n of nodes) {
    if (registry[n.type]?.hasFeedback) return true;
  }
  // (a) — direct cycle via DFS
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id, []));
  wires.forEach(w => {
    if (adj.has(w.from.nodeId) && adj.has(w.to.nodeId))
      adj.get(w.from.nodeId).push(w.to.nodeId);
  });
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(); nodes.forEach(n => color.set(n.id, WHITE));
  function dfs(id) {
    color.set(id, GRAY);
    for (const nxt of (adj.get(id) || [])) {
      if (color.get(nxt) === GRAY) return true;
      if (color.get(nxt) === WHITE && dfs(nxt)) return true;
    }
    color.set(id, BLACK); return false;
  }
  for (const n of nodes) if (color.get(n.id) === WHITE && dfs(n.id)) return true;
  return false;
}

// ── Evaluate one gate node ───────────────────────────────────────────────────
function evalGate(type, ins, registry) {
  switch (type) {
    case "AND":      return [(ins[0] && ins[1]) ? 1 : 0];
    case "OR":       return [(ins[0] || ins[1]) ? 1 : 0];
    case "NOT":      return [ins[0] ? 0 : 1];
    case "LED":      return [ins[0] ? 1 : 0];
    case "SWITCH":   return [ins[0] ?? 0];
    case "JUNCTION": return [ins[0] ?? 0];
    default: {
      const comp = registry[type];
      if (!comp) return [0];
      if (comp.hasFeedback) return new Array(comp.outputCount).fill(0); // placeholder — caller handles live
      if (comp.truthTable) {
        const key = ins.slice(0, comp.inputCount).join("");
        return comp.truthTable[key] ?? new Array(comp.outputCount).fill(0);
      }
      return [0];
    }
  }
}

// ── Combinational truth-table builder ───────────────────────────────────────
// Only called when hasFeedbackCircuit() returned false, so no nested feedback here.
function buildTruthTable(nodes, wires, inputPinMap, outputPinMap, registry) {
  const ic = inputPinMap.length;
  const table = {};
  const incoming = new Map();
  nodes.forEach(n => incoming.set(n.id, []));
  wires.forEach(w => {
    if (!incoming.has(w.to.nodeId)) incoming.set(w.to.nodeId, []);
    incoming.get(w.to.nodeId).push(w);
  });
  const ordered = topoSort(nodes, wires);

  for (let combo = 0; combo < (1 << ic); combo++) {
    const iv = Array.from({ length: ic }, (_, i) => (combo >> (ic - 1 - i)) & 1);
    const key = iv.join("");
    const values = {};
    nodes.forEach(n => { values[n.id] = [n.value ?? 0]; });
    inputPinMap.forEach(({ nodeId }, i) => { values[nodeId] = [iv[i]]; });

    for (let iter = 0; iter < 40; iter++) {
      let changed = false;
      ordered.forEach(node => {
        if (node.type === "SWITCH" || node.type === "CLOCK") return;
        const comp = registry[node.type];
        const ei = node.type === "NOT" || node.type === "LED" || node.type === "JUNCTION" ? 1
          : comp ? comp.inputCount : 2;
        const ins = new Array(ei).fill(0);
        (incoming.get(node.id) || []).forEach(w => {
          if (w.to.index < ei) ins[w.to.index] = readOutput(values, w.from.nodeId, w.from.index ?? 0);
        });
        const nv = evalGate(node.type, ins, registry);
        if (!arrEq(values[node.id], nv)) { values[node.id] = nv; changed = true; }
      });
      if (!changed) break;
    }
    table[key] = outputPinMap.map(({ nodeId }) => readOutput(values, nodeId, 0));
  }
  return table;
}

// ── Live simulation for circuits with feedback (latches, registers, etc.) ────
//
// `currentInternalState` is a plain object:
//   nodeId → value-array        (for primitive gate nodes)
//   "__sub_" + nodeId → object  (recursive sub-state for nested feedback components)
//
// The function is fully recursive: a register containing D-latches, each containing
// cross-coupled NANDs, will correctly thread state all the way down.
//
export function evaluateFeedbackComponent(compType, inputValues, currentInternalState = {}) {
  const comp = customComponentRegistry[compType];
  if (!comp) return { outputs: [], newInternalState: {} };

  const { nodes, wires, inputPinMap, outputPinMap } = comp;
  const registry = customComponentRegistry;

  // --- Seed node values from stored state (this is the "memory") ---
  const values = {};
  nodes.forEach(n => {
    const stored = currentInternalState[n.id];
    values[n.id] = Array.isArray(stored) ? [...stored] : [n.value ?? 0];
  });
  // Inject this cycle's external inputs
  inputPinMap.forEach(({ nodeId }, i) => { values[nodeId] = [inputValues[i] ?? 0]; });

  // Build incoming wire index
  const incoming = {};
  nodes.forEach(n => { incoming[n.id] = []; });
  wires.forEach(w => {
    if (!incoming[w.to.nodeId]) incoming[w.to.nodeId] = [];
    incoming[w.to.nodeId].push(w);
  });

  // Working copy of sub-component states (mutated as we simulate each pass)
  const subStates = {};
  nodes.forEach(n => {
    if (registry[n.type]?.hasFeedback)
      subStates[n.id] = currentInternalState[`__sub_${n.id}`] || {};
  });

  // --- Iterative relaxation until stable ---
  // 200 passes handles deeply nested feedback circuits.
  for (let pass = 0; pass < 200; pass++) {
    let changed = false;
    nodes.forEach(node => {
      if (node.type === "SWITCH" || node.type === "CLOCK") return;

      const subComp = registry[node.type];
      const ei = node.type === "NOT" || node.type === "LED" || node.type === "JUNCTION" ? 1
        : subComp ? subComp.inputCount : 2;

      const ins = new Array(ei).fill(0);
      (incoming[node.id] || []).forEach(w => {
        if (w.to.index < ei) ins[w.to.index] = readOutput(values, w.from.nodeId, w.from.index ?? 0);
      });

      let newVal;
      if (subComp?.hasFeedback) {
        // Recursively simulate nested feedback component with its own persisted state
        const result = evaluateFeedbackComponent(node.type, ins, subStates[node.id] || {});
        subStates[node.id] = result.newInternalState; // ← keep the updated sub-state
        newVal = result.outputs.length > 0
          ? result.outputs
          : new Array(subComp.outputCount).fill(0);
      } else if (subComp?.truthTable) {
        const k = ins.slice(0, subComp.inputCount).join("");
        newVal = subComp.truthTable[k] ?? new Array(subComp.outputCount).fill(0);
      } else {
        newVal = evalGate(node.type, ins, registry);
      }

      if (!arrEq(values[node.id], newVal)) {
        values[node.id] = newVal;
        changed = true;
      }
    });
    if (!changed) break;
  }

  // --- Collect outputs ---
  const outputs = outputPinMap.map(({ nodeId }) => readOutput(values, nodeId, 0));

  // --- Persist full internal state ---
  const newInternalState = {};
  nodes.forEach(n => {
    newInternalState[n.id] = Array.isArray(values[n.id]) ? [...values[n.id]] : [0];
    if (subStates[n.id] !== undefined)
      newInternalState[`__sub_${n.id}`] = subStates[n.id];
  });

  return { outputs, newInternalState };
}

// ── Public API ───────────────────────────────────────────────────────────────

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

  // Check if this circuit has feedback at ANY depth (direct cycle OR nested component)
  const feedback = hasFeedbackCircuit(clonedNodes, clonedWires, customComponentRegistry);

  customComponentRegistry[name] = {
    name,
    inputPinMap:  sortedInputs,
    outputPinMap: sortedOutputs,
    inputCount:   sortedInputs.length,
    outputCount:  sortedOutputs.length,
    hasFeedback:  feedback,
    // Combinational: bake truth table.  Sequential: null — always simulated live.
    truthTable: feedback
      ? null
      : buildTruthTable(clonedNodes, clonedWires, sortedInputs, sortedOutputs, customComponentRegistry),
    nodes: clonedNodes,
    wires: clonedWires,
  };
 
  localStorage.setItem("customComponents", JSON.stringify(customComponentRegistry));
}
 
export function loadSavedComponents() {
  const saved = localStorage.getItem("customComponents");
  if (saved) Object.assign(customComponentRegistry, JSON.parse(saved));
}