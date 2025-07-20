/**
 * @file AnalysisContext.tsx
 * @description
 * Defines the React context `AnalysisContext` used to share metadata about the most recent course analysis
 * across the application. It provides two values: `lastAnalyzedAgo`, a relative time string (e.g., "2 minutes ago"),
 * and `lastAnalyzedAt`, the exact timestamp of the analysis as a Date object.
 *
 * This context allows components like export utilities and graph displays to access analysis timing
 * information without prop drilling, ensuring consistent behavior and labeling across the UI.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {createContext, useContext} from "react";

interface AnalysisContextProps {
    lastAnalyzedAgo: string | null;
    lastAnalyzedAt: Date | null;
}

export const AnalysisContext = createContext<AnalysisContextProps>({
    lastAnalyzedAgo: null,
    lastAnalyzedAt: null,
});

export const useAnalysisContext = () => useContext(AnalysisContext);
