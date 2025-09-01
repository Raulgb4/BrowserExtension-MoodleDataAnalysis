/**
 * @file AnalysisProgressContext.tsx
 *
 * @description
 * React context for tracking the progress of course analysis (scraping).
 * Provides functions to start, update, and complete a progress session,
 * and exposes the current progress state to the UI (e.g., Loader component).
 *
 * @author Raúl
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
