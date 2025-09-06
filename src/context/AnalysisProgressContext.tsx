/**
 * @file AnalysisProgressContext.tsx
 * @description
 * React context for tracking the progress of Moodle course analysis (scraping).
 * Provides state and utility functions to:
 *   - Start a new analysis session.
 *   - Set the total number of steps.
 *   - Increment the current step (tick).
 *   - Update the progress label.
 *   - Mark the analysis as complete.
 *   - Reset the progress state.
 *
 * The context also exposes the timestamp of the last completed analysis,
 * enabling features like "last analyzed X minutes ago" in the UI.
 *
 * Typical usage:
 *   - Wrap the app with <AnalysisProvider>.
 *   - Access progress state and methods via useAnalysisContext().
 *   - Bind UI components (e.g., Loader) to reflect progress updates.
 *
 * @author
 * Raúl García Balongo
 * @date 2025
 */


import React, {createContext, ReactNode, useCallback, useContext, useState,} from "react";

// ---- Types ----
export interface AnalysisProgressState {
    inProgress: boolean;
    step: number;
    total: number;
    percent: number; // Computed as (a step / total) * 100
    label: string;
}

export interface AnalysisContextValue {
    progress: AnalysisProgressState;
    lastAnalyzedAt: Date | null;
    start: (label?: string) => void;
    setTotal: (total: number) => void;
    tick: (inc?: number) => void;
    setLabel: (label: string) => void;
    complete: () => void;
    reset: () => void;
}

// ---- Default state ----
const initialProgress: AnalysisProgressState = {
    inProgress: false,
    step: 0,
    total: 0,
    percent: 0,
    label: "",
};

// ---- Context ----
const AnalysisContext = createContext<AnalysisContextValue | undefined>(
    undefined
);

// ---- Provider ----
export const AnalysisProvider: React.FC<{ children: ReactNode }> = ({
                                                                        children,
                                                                    }) => {
    const [progress, setProgress] = useState<AnalysisProgressState>(
        initialProgress
    );
    const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);

    // Start progress
    const start = useCallback((label: string = "") => {
        setProgress({
            inProgress: true,
            step: 0,
            total: 0,
            percent: 0,
            label,
        });
    }, []);

    // Set total steps
    const setTotal = useCallback((total: number) => {
        setProgress((prev) => ({
            ...prev,
            total,
            percent: prev.total > 0 ? (prev.step / total) * 100 : 0,
        }));
    }, []);

    // Increment progress
    const tick = useCallback((inc: number = 1) => {
        setProgress((prev) => {
            const step = prev.step + inc;
            const percent =
                prev.total > 0 ? Math.min((step / prev.total) * 100, 100) : 0;
            return {...prev, step, percent};
        });
    }, []);

    // Update label
    const setLabel = useCallback((label: string) => {
        setProgress((prev) => ({...prev, label}));
    }, []);

    // Mark as complete
    const complete = useCallback(() => {
        setProgress((prev) => ({
            ...prev,
            inProgress: false,
            step: prev.total,
            percent: 100,
        }));
        setLastAnalyzedAt(new Date());
    }, []);

    // Reset progress
    const reset = useCallback(() => {
        setProgress(initialProgress);
    }, []);

    return (
        <AnalysisContext.Provider
            value={{
                progress,
                lastAnalyzedAt,
                start,
                setTotal,
                tick,
                setLabel,
                complete,
                reset,
            }}
        >
            {children}
        </AnalysisContext.Provider>
    );
};

// ---- Hook ----
export function useAnalysisContext(): AnalysisContextValue {
    const ctx = useContext(AnalysisContext);
    if (!ctx) {
        throw new Error(
            "useAnalysisContext must be used within an AnalysisProvider"
        );
    }
    return ctx;
}
