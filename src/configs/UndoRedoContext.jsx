import { createContext, useContext, useRef, useCallback, useState } from "react";

const UndoRedoContext = createContext(null);

export function UndoRedoProvider({ children }) {
    const stackRef = useRef([]);
    const pointerRef = useRef(-1);
    const onStateChangeRef = useRef(null);
    const maxHistory = 50;
    const [updateTrigger, setUpdateTrigger] = useState(0); // Force re-renders on undo/redo

    const push = useCallback((state, description = "") => {
        // Remove future history when new state is pushed (branching)
        stackRef.current = stackRef.current.slice(0, pointerRef.current + 1);
        
        stackRef.current.push({ state, description, timestamp: Date.now() });
        
        // Keep only last maxHistory items, adjusting pointer if needed
        if (stackRef.current.length > maxHistory) {
            stackRef.current.shift();
            // If we removed the first item, pointer doesn't change (it was never pointing before 0)
            // but if pointer is at 0, keep it at 0
            if (pointerRef.current > 0) pointerRef.current--;
        }
        
        pointerRef.current = stackRef.current.length - 1;
    }, [maxHistory]);

    const undo = useCallback(() => {
        if (pointerRef.current > 0) {
            pointerRef.current--;
            const state = stackRef.current[pointerRef.current]?.state;
            if (state && onStateChangeRef.current) {
                onStateChangeRef.current(state);
                setUpdateTrigger(prev => prev + 1); // Force UI update
            }
        }
    }, []);

    const redo = useCallback(() => {
        if (pointerRef.current < stackRef.current.length - 1) {
            pointerRef.current++;
            const state = stackRef.current[pointerRef.current]?.state;
            if (state && onStateChangeRef.current) {
                onStateChangeRef.current(state);
                setUpdateTrigger(prev => prev + 1); // Force UI update
            }
        }
    }, []);

    // Compute canUndo/canRedo dynamically
    const canUndo = pointerRef.current > 0;
    const canRedo = pointerRef.current < stackRef.current.length - 1;
    
    // Trigger re-computation by referencing updateTrigger
    void updateTrigger;

    const clear = useCallback(() => {
        stackRef.current = [];
        pointerRef.current = -1;
        setUpdateTrigger(prev => prev + 1);
    }, []);

    const setStateChangeHandler = useCallback((handler) => {
        onStateChangeRef.current = handler;
    }, []);
    
    // Helper to get current state (for debugging or external checks)
    const getState = useCallback(() => {
        return stackRef.current[pointerRef.current]?.state || null;
    }, []);

    const value = {
        push,
        undo,
        redo,
        canUndo,
        canRedo,
        clear,
        setStateChangeHandler,
        getState,
    };

    return (
        <UndoRedoContext.Provider value={value}>
            {children}
        </UndoRedoContext.Provider>
    );
}

export function useUndoRedo() {
    const ctx = useContext(UndoRedoContext);
    if (!ctx) {
        throw new Error("useUndoRedo must be used within UndoRedoProvider");
    }
    return ctx;
}
