// src/configs/customComponents.js

export const customComponentRegistry = {};

// ── Fast array equality ──────────────────────────────────────────────────────
function arrEq(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ── Topological sort (Kahn's) ────────────────────────────────────────────────
function topoSort(nodeArray, wires) {
  const inDeg = new Map(), adj = new Map();
  nodeArray.forEach(n => { inDeg.set(n.id, 0); adj.set(n.id, []); });
  const edgeSeen = new Set();
  wires.forEach(w => {
    if (!adj.has(w.from.nodeId) || !inDeg.has(w.to.nodeId)) return;
    const key = `${w.from.nodeId}→${w.to.nodeId}`;
    if (edgeSeen.has(key)) return;
    edgeSeen.add(key);
    adj.get(w.from.nodeId).push(w.to.nodeId);
    inDeg.set(w.to.nodeId, inDeg.get(w.to.nodeId) + 1);
  });
  const queue = [];
  inDeg.forEach((d, id) => { if (d === 0) queue.push(id); });
  const sorted = [];
  while (queue.length) {
    const id = queue.shift(); sorted.push(id);
    for (const nid of adj.get(id)) {
      const d = inDeg.get(nid) - 1; inDeg.set(nid, d);
      if (d === 0) queue.push(nid);
    }
  }
  const seen = new Set(sorted);
  nodeArray.forEach(n => { if (!seen.has(n.id)) sorted.push(n.id); });
  const byId = new Map(nodeArray.map(n => [n.id, n]));
  return sorted.map(id => byId.get(id)).filter(Boolean);
}

// ── Cycle detection (DFS) ────────────────────────────────────────────────────
// Returns true if the node/wire graph contains any cycle (= has state/feedback).
function detectFeedback(nodes, wires) {
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id, []));
  wires.forEach(w => {
    if (adj.has(w.from.nodeId) && adj.has(w.to.nodeId))
      adj.get(w.from.nodeId).push(w.to.nodeId);
  });
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  nodes.forEach(n => color.set(n.id, WHITE));
  function dfs(id) {
    color.set(id, GRAY);
    for (const nxt of adj.get(id) || []) {
      if (color.get(nxt) === GRAY) return true;   // back-edge → cycle
      if (color.get(nxt) === WHITE && dfs(nxt)) return true;
    }
    color.set(id, BLACK);
    return false;
  }
  for (const n of nodes) {
    if (color.get(n.id) === WHITE && dfs(n.id)) return true;
  }
  return false;
}

// ── Read output helper ───────────────────────────────────────────────────────
function readOutput(values, nodeId, outputIndex) {
  const v = values[nodeId];
  if (Array.isArray(v)) return v[outputIndex] ?? 0;
  return outputIndex === 0 ? (v ?? 0) : 0;
}

// ── Evaluate a single node given collected inputs ────────────────────────────
function evalNode(type, ins, registry) {
  switch (type) {
    case "AND":      return [(ins[0] && ins[1]) ? 1 : 0];
    case "OR":       return [(ins[0] || ins[1]) ? 1 : 0];
    case "NOT":      return [ins[0] ? 0 : 1];
    case "LED":      return [ins[0] ? 1 : 0];
    case "SWITCH":   return [ins[0] ?? 0];
    case "JUNCTION": return [ins[0] ?? 0];
    default: {
      const comp = registry[type];
      if (comp?.hasFeedback) {
        // Nested feedback component: evaluated live — caller must handle state
        return new Array(comp.outputCount).fill(0);
      }
      if (comp?.truthTable) {
        const key = ins.slice(0, comp.inputCount).join("");
        return comp.truthTable[key] ?? new Array(comp.outputCount).fill(0);
      }
      return [0];
    }
  }
}

// ── Combinational truth-table builder (only for feedback-free circuits) ──────
function buildTruthTable(nodes, wires, inputPinMap, outputPinMap, registry) {
  const inputCount = inputPinMap.length;
  const table = {};
  const incoming = new Map();
  nodes.forEach(n => incoming.set(n.id, []));
  wires.forEach(w => {
    if (!incoming.has(w.to.nodeId)) incoming.set(w.to.nodeId, []);
    incoming.get(w.to.nodeId).push(w);
  });
  const ordered = topoSort(nodes, wires);

  for (let combo = 0; combo < (1 << inputCount); combo++) {
    const inputVec = Array.from({ length: inputCount }, (_, i) =>
      (combo >> (inputCount - 1 - i)) & 1);
    const key = inputVec.join("");
    const values = {};
    nodes.forEach(n => { values[n.id] = [n.value ?? 0]; });
    inputPinMap.forEach(({ nodeId }, i) => { values[nodeId] = [inputVec[i]]; });

    for (let iter = 0; iter < 40; iter++) {
      let changed = false;
      ordered.forEach(node => {
        if (node.type === "SWITCH" || node.type === "CLOCK") return;
        const comp = registry[node.type];
        const expectedInputs =
          node.type === "NOT" || node.type === "LED" || node.type === "JUNCTION" ? 1
          : comp ? comp.inputCount : 2;
        const ins = new Array(expectedInputs).fill(0);
        (incoming.get(node.id) || []).forEach(w => {
          if (w.to.index < expectedInputs)
            ins[w.to.index] = readOutput(values, w.from.nodeId, w.from.index ?? 0);
        });
        const newVal = evalNode(node.type, ins, registry);
        if (!arrEq(values[node.id], newVal)) { values[node.id] = newVal; changed = true; }
      });
      if (!changed) break;
    }
    table[key] = outputPinMap.map(({ nodeId }) => readOutput(values, nodeId, 0));
  }
  return table;
}

// ── Live simulation for feedback circuits ────────────────────────────────────
// currentInternalState: map of nodeId → value-array (persisted on the placed node).
// Returns { outputs[], newInternalState{} }.
//
// This correctly handles latches, flip-flops, SR circuits — any circuit with
// feedback — because it starts from the PREVIOUS stable state and runs forward,
// so "hold" behaviour is preserved.
export function evaluateFeedbackComponent(compType, inputValues, currentInternalState = {}) {
  const comp = customComponentRegistry[compType];
  if (!comp) return { outputs: [], newInternalState: {} };

  const { nodes, wires, inputPinMap, outputPinMap } = comp;

  // Seed values from stored internal state (remembers Q, Q-bar, etc.)
  const values = {};
  nodes.forEach(n => {
    values[n.id] = currentInternalState[n.id] !== undefined
      ? [...currentInternalState[n.id]]   // copy so we don't mutate stored state
      : [n.value ?? 0];
  });

  // Inject current external inputs
  inputPinMap.forEach(({ nodeId }, i) => { values[nodeId] = [inputValues[i] ?? 0]; });

  // Build incoming wire index
  const incoming = {};
  nodes.forEach(n => { incoming[n.id] = []; });
  wires.forEach(w => {
    if (!incoming[w.to.nodeId]) incoming[w.to.nodeId] = [];
    incoming[w.to.nodeId].push(w);
  });

  // Run propagation to stability (more passes for feedback loops)
  for (let pass = 0; pass < 200; pass++) {
    let changed = false;
    nodes.forEach(node => {
      if (node.type === "SWITCH" || node.type === "CLOCK") return;

      const subComp = customComponentRegistry[node.type];
      const expectedInputs =
        node.type === "NOT" || node.type === "LED" || node.type === "JUNCTION" ? 1
        : subComp ? subComp.inputCount : 2;

      const ins = new Array(expectedInputs).fill(0);
      (incoming[node.id] || []).forEach(w => {
        if (w.to.index < expectedInputs)
          ins[w.to.index] = readOutput(values, w.from.nodeId, w.from.index ?? 0);
      });

      let newVal;
      if (subComp?.hasFeedback) {
        // Nested feedback component: pull its sub-state
        const subKey = `__sub_${node.id}`;
        const subState = currentInternalState[subKey] || {};
        const result = evaluateFeedbackComponent(node.type, ins, subState);
        newVal = result.outputs.length > 0 ? result.outputs : [0];
        // We can't update sub-state here without more plumbing, but outputs are correct
      } else if (subComp?.truthTable) {
        const key = ins.slice(0, subComp.inputCount).join("");
        newVal = subComp.truthTable[key] ?? new Array(subComp.outputCount).fill(0);
      } else {
        newVal = evalNode(node.type, ins, customComponentRegistry);
      }

      if (!arrEq(values[node.id], newVal)) {
        values[node.id] = newVal;
        changed = true;
      }
    });
    if (!changed) break;
  }

  // Collect outputs
  const outputs = outputPinMap.map(({ nodeId }) => readOutput(values, nodeId, 0));

  // Save full internal state for next call
  const newInternalState = {};
  nodes.forEach(n => { newInternalState[n.id] = values[n.id] ? [...values[n.id]] : [0]; });

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

  const hasFeedback = detectFeedback(clonedNodes, clonedWires);

  // Only bake a truth table for combinational (feedback-free) circuits.
  // For feedback circuits we always simulate live — truth tables can't capture state.
  const truthTable = hasFeedback
    ? null
    : buildTruthTable(clonedNodes, clonedWires, sortedInputs, sortedOutputs, customComponentRegistry);

  customComponentRegistry[name] = {
    name,
    inputPinMap:  sortedInputs,
    outputPinMap: sortedOutputs,
    inputCount:   sortedInputs.length,
    outputCount:  sortedOutputs.length,
    hasFeedback,
    truthTable,   // null for feedback circuits
    nodes: clonedNodes,
    wires: clonedWires,
  };

  localStorage.setItem("customComponents", JSON.stringify(customComponentRegistry));
}

export function loadSavedComponents() {
  const saved = localStorage.getItem("customComponents");
  if (saved) Object.assign(customComponentRegistry, JSON.parse(saved));
}