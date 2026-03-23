import { createContext, useContext, useRef, useCallback } from "react";

const UndoRedoContext = createContext(null);

export function UndoRedoProvider({ children }) {
    const stackRef = useRef([]);
    const pointerRef = useRef(-1);
    const onStateChangeRef = useRef(null);
    const maxHistory = 50;

    const push = useCallback((state, description = "") => {
        // Remove future history when new state is pushed
        stackRef.current = stackRef.current.slice(0, pointerRef.current + 1);
        
        stackRef.current.push({ state, description, timestamp: Date.now() });
        
        // Keep only last maxHistory items
        if (stackRef.current.length > maxHistory) {
            stackRef.current.shift();
        }
        
        pointerRef.current = stackRef.current.length - 1;
    }, []);

    const undo = useCallback(() => {
        if (pointerRef.current > 0) {
            pointerRef.current--;
            const state = stackRef.current[pointerRef.current]?.state;
            if (state && onStateChangeRef.current) {
                onStateChangeRef.current(state);
            }
        }
    }, []);

    const redo = useCallback(() => {
        if (pointerRef.current < stackRef.current.length - 1) {
            pointerRef.current++;
            const state = stackRef.current[pointerRef.current]?.state;
            if (state && onStateChangeRef.current) {
                onStateChangeRef.current(state);
            }
        }
    }, []);

    const canUndo = pointerRef.current > 0;
    const canRedo = pointerRef.current < stackRef.current.length - 1;

    const clear = useCallback(() => {
        stackRef.current = [];
        pointerRef.current = -1;
    }, []);

    const setStateChangeHandler = useCallback((handler) => {
        onStateChangeRef.current = handler;
    }, []);

    const value = {
        push,
        undo,
        redo,
        canUndo,
        canRedo,
        clear,
        setStateChangeHandler,
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


