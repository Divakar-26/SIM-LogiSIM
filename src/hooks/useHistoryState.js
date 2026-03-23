import { useCallback, useEffect, useRef } from "react";
import { useUndoRedo } from "../configs/UndoRedoContext.jsx";

export function useHistoryState(nodes, setNodes, wires, setWires, regions, setRegions) {
    const { push, undo, redo, canUndo, canRedo, setStateChangeHandler, getState } = useUndoRedo();
    const lastStateRef = useRef(JSON.stringify({ nodes, wires, regions }));
    const isTrackingRef = useRef(true);
    const hasInitializedRef = useRef(false);

    // Register the restoration callback once - update lastStateRef after restoration
    useEffect(() => {
        setStateChangeHandler((state) => {
            if (state) {
                setNodes(state.nodes || []);
                setWires(state.wires || []);
                setRegions(state.regions || []);
                // Update lastStateRef so next change detection works correctly
                lastStateRef.current = JSON.stringify(state);
            }
        });
    }, [setStateChangeHandler, setNodes, setWires, setRegions]);

    // Save initial state once on first render
    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            push({ nodes, wires, regions }, "Initial state");
            lastStateRef.current = JSON.stringify({ nodes, wires, regions });
        }
    }, []);

    // Auto-save when state changes (unless tracking is paused)
    useEffect(() => {
        if (!isTrackingRef.current) return;
        if (!hasInitializedRef.current) return; // Don't save before initialization
        
        const currentState = JSON.stringify({ nodes, wires, regions });
        if (currentState !== lastStateRef.current) {
            push({ nodes, wires, regions });
            lastStateRef.current = currentState;
        }
    }, [nodes, wires, regions, push]);

    // Save snapshot manually
    const saveSnapshot = useCallback((description = "") => {
        push({ nodes, wires, regions }, description);
        lastStateRef.current = JSON.stringify({ nodes, wires, regions });
    }, [nodes, wires, regions, push]);

    // Pause and resume tracking (for batching operations like dragging)
    const pauseTracking = useCallback(() => {
        isTrackingRef.current = false;
    }, []);

    const resumeTracking = useCallback(() => {
        isTrackingRef.current = true;
    }, []);

    // Undo/Redo handlers (don't call undo/redo directly, use the callbacks)
    const handleUndo = useCallback(() => {
        undo();
    }, [undo]);

    const handleRedo = useCallback(() => {
        redo();
    }, [redo]);

    // Keyboard shortcuts - attached once with stable reference
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [undo, redo]);

    return {
        saveSnapshot,
        handleUndo,
        handleRedo,
        canUndo,
        canRedo,
        pauseTracking,
        resumeTracking,
    };
}


