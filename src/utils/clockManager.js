// src/utils/clockManager.js
//
// Manages all CLOCK node timers. Workspace calls syncClocks() in a useEffect
// whenever nodes change. When a tick fires, it calls the registered onChange
// handler with (nodeId, newValue) so Workspace can update node state.

const timers   = new Map(); // nodeId → timeoutId
const params   = new Map(); // nodeId → { hz, duty } — last known params
const phases   = new Map(); // nodeId → current output value (0 | 1)

let _onChange = null;

/** Register the callback that fires on every clock edge. */
export function setClockChangeHandler(fn) {
    _onChange = fn;
}

/**
 * Call after every nodes-state update.
 * Starts timers for new CLOCK nodes, restarts on param change,
 * and cleans up timers for removed nodes.
 */
export function syncClocks(nodes) {
    const clockNodes = nodes.filter(n => n.type === "CLOCK");
    const liveIds    = new Set(clockNodes.map(n => n.id));

    // ── Remove timers for clocks that no longer exist ──
    for (const id of [...timers.keys()]) {
        if (!liveIds.has(id)) {
            clearTimeout(timers.get(id));
            timers.delete(id);
            params.delete(id);
            phases.delete(id);
        }
    }

    // ── Start / restart timers ──
    for (const node of clockNodes) {
        const hz   = clamp(node.hz   ?? 1,   0.1, 100);
        const duty = clamp(node.duty ?? 0.5, 0.01, 0.99);

        const prev = params.get(node.id);
        const paramsChanged = !prev || prev.hz !== hz || prev.duty !== duty;

        if (!timers.has(node.id) || paramsChanged) {
            // Cancel existing timer
            if (timers.has(node.id)) {
                clearTimeout(timers.get(node.id));
                timers.delete(node.id);
            }
            params.set(node.id, { hz, duty });

            // Start the alternating-timeout loop
            scheduleTick(node.id, hz, duty, phases.get(node.id) ?? 0);
        }
    }
}

function scheduleTick(nodeId, hz, duty, currentPhase) {
    const period  = 1000 / hz;
    // currentPhase is the phase we're *currently in*,
    // so we wait its remaining half-period then flip.
    const delay   = currentPhase === 1
        ? period * duty           // currently HIGH → stay high for this long
        : period * (1 - duty);    // currently LOW  → stay low for this long

    const tid = setTimeout(() => {
        const nextPhase = currentPhase === 0 ? 1 : 0;
        phases.set(nodeId, nextPhase);
        if (_onChange) _onChange(nodeId, nextPhase);

        // Check if node still exists & params unchanged before rescheduling
        const p = params.get(nodeId);
        if (p) scheduleTick(nodeId, p.hz, p.duty, nextPhase);
    }, delay);

    timers.set(nodeId, tid);
}

/** Stop all running clock timers (e.g. on unmount). */
export function stopAllClocks() {
    for (const tid of timers.values()) clearTimeout(tid);
    timers.clear();
    params.clear();
    phases.clear();
}

/** Current output value of a clock node (used for initial render). */
export function getClockPhase(nodeId) {
    return phases.get(nodeId) ?? 0;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}