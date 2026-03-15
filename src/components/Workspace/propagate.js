// src/components/Workspace/propagate.js
// Optimized combinational propagation + live-simulation fallthrough for
// feedback (sequential) custom components (latches, SR, D, T, JK, etc.).

import { evaluateCustomComponent } from "../../utils/propagateCustom";
import { evaluateFeedbackComponent } from "../../configs/customComponents";
import { customComponentRegistry }  from "../../configs/customComponents";

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

function arrEq(a, b) {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

// Deep-compare two internalState objects (map of nodeId → value-array)
function internalStateEq(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) { if (!arrEq(a[k], b[k])) return false; }
    return true;
}

export function propagate(nodes, wires) {
    const nodeMap   = new Map();
    const outgoing  = new Map();  // nodeId → Wire[]
    const inputsMap = new Map();  // nodeId → value[]

    // Don't copy source nodes; copy everything else so we can mutate safely
    nodes.forEach(n => {
        const isSource = n.type === "SWITCH" || n.type === "CLOCK";
        nodeMap.set(n.id, isSource ? n : { ...n });
    });

    wires.forEach(w => {
        const from = nodeMap.get(w.from.nodeId);
        if (!from) return;
        let ow = outgoing.get(w.from.nodeId);
        if (!ow) { ow = []; outgoing.set(w.from.nodeId, ow); }
        ow.push(w);
        let arr = inputsMap.get(w.to.nodeId);
        if (!arr) { arr = []; inputsMap.set(w.to.nodeId, arr); }
        arr[w.to.index] = (from.outputs && from.outputs[w.from.index] !== undefined)
            ? from.outputs[w.from.index] : from.value;
    });

    const ordered = topoSort(Array.from(nodeMap.values()), wires);

    ordered.forEach(node => {
        if (node.type === "SWITCH" || node.type === "CLOCK" || node.type.startsWith("IN_")) return;

        const custom = customComponentRegistry[node.type];

        let expectedInputs;
        if (node.type === "NOT" || node.type === "LED" || node.type === "JUNCTION") expectedInputs = 1;
        else if (node.type.startsWith("OUT_")) expectedInputs = parseInt(node.type.split("_")[1]) || 1;
        else if (custom) expectedInputs = custom.inputPinMap.length;
        else expectedInputs = 2;

        const inArr  = inputsMap.get(node.id) || [];
        const filled = [];
        for (let i = 0; i < expectedInputs; i++) filled[i] = inArr[i] ?? 0;

        let nv = node.value, no = node.outputs;

        switch (node.type) {
            case "AND":      nv = filled[0] && filled[1] ? 1 : 0; break;
            case "OR":       nv = filled[0] || filled[1] ? 1 : 0; break;
            case "NOT":      nv = filled[0] ? 0 : 1;              break;
            case "LED":      nv = filled[0] ? 1 : 0;              break;
            case "JUNCTION": nv = filled[0] ?? 0;                  break;
            default:
                if (node.type.startsWith("OUT_")) {
                    nv = filled[0] ?? 0;
                    no = filled.slice();
                } else if (custom?.hasFeedback) {
                    // ── Sequential / feedback custom component ─────────────────
                    // Use live simulation so "hold" states are preserved.
                    // node.internalState carries the previous stable internal values.
                    const { outputs, newInternalState } = evaluateFeedbackComponent(
                        node.type, filled, node.internalState || {}
                    );
                    // Always store the new internal state regardless of output change
                    node.internalState = newInternalState;
                    if (!arrEq(no, outputs)) { no = outputs; nv = outputs[0] ?? 0; }
                } else if (custom) {
                    // ── Combinational custom component (O(1) truth-table lookup)
                    const outs = evaluateCustomComponent(node.type, filled);
                    if (!arrEq(no, outs)) { no = outs; nv = outs[0] ?? 0; }
                }
        }

        if (nv !== node.value || !arrEq(no, node.outputs)) {
            node.value   = nv;
            node.outputs = no;
            const ow = outgoing.get(node.id);
            if (ow) ow.forEach(w => {
                let arr = inputsMap.get(w.to.nodeId);
                if (!arr) { arr = []; inputsMap.set(w.to.nodeId, arr); }
                arr[w.to.index] = (no && no[w.from.index] !== undefined) ? no[w.from.index] : nv;
            });
        }
    });

    // ── Build result — reuse original references where nothing changed ────────
    // For feedback components, ALSO check internalState so state is persisted.
    let dirty = false;
    const result = nodes.map(orig => {
        const u = nodeMap.get(orig.id);
        if (!u || u === orig) return orig;

        const custom = customComponentRegistry[orig.type];
        const stateChanged = custom?.hasFeedback && !internalStateEq(u.internalState, orig.internalState);

        if (u.value !== orig.value || !arrEq(u.outputs, orig.outputs) || stateChanged) {
            dirty = true;
            return u;
        }
        return orig;
    });

    return dirty ? result : nodes;
}