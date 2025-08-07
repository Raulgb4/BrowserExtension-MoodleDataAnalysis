/**
 * @file ExportContext.tsx
 * @description
 * Defines the React context `ExportContext`, which provides an infrastructure to dynamically register
 * exportable charts from various parts of the application.
 *
 * Each registered chart includes its reference (`chartRef`), a descriptive title, labels, and values
 * that are later used in export functions (PDF, DOCX, CSV, etc.).
 *
 * The context exposes three main methods:
 * - `register`: adds a new exportable chart, preventing duplicates.
 * - `unregister`: removes a previously registered chart.
 * - `getAll`: retrieves all currently registered exportables.
 *
 * This architecture enables a centralized collection of all active charts in the UI without prop drilling,
 * facilitating automatic generation of global reports.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {
    createContext,
    FC,
    ReactNode,
    RefObject,
    useContext,
    useRef,
    useState,
} from "react";
import type {Chart} from "chart.js";

// Chart data registered by each GraphBlock
export interface Exportable {
    chartRef: RefObject<Chart | null>;
    title: string;
    labels: string[];
    values: number[];
}

// Context type with new properties
interface ExportContextType {
    register: (exportable: Exportable) => void;
    unregister: (chartRef: RefObject<Chart | null>) => void;
    getAll: () => Exportable[];

    forceRenderTabs: string[]; // Tabs to render invisibly for export
    triggerExportAll: (activeTab: string, format: "pdf" | "docx") => void; // Export trigger
}

// Create context
const ExportContext = createContext<ExportContextType | undefined>(undefined);

// Provider implementation
export const ExportProvider: FC<{ children: ReactNode }> = ({children}) => {
    const exportablesRef = useRef<Exportable[]>([]);
    const [forceRenderTabs, setForceRenderTabs] = useState<string[]>([]);

    const register = (exportable: Exportable) => {
        const alreadyRegistered = exportablesRef.current.some(
            (e) => e.chartRef === exportable.chartRef
        );
        if (!alreadyRegistered) {
            exportablesRef.current.push(exportable);
        }
    };

    const unregister = (chartRef: RefObject<Chart | null>) => {
        exportablesRef.current = exportablesRef.current.filter(
            (e) => e.chartRef !== chartRef
        );
    };

    const getAll = () => exportablesRef.current;

    /**
     * Triggers global export by forcing other tabs to render invisibly.
     * After a short delay, it dispatches a custom event that export utils listens to.
     */
    const triggerExportAll = (activeTab: string, format: "pdf" | "docx") => {
        const allTabs = [
            "tab_global",
            "tab_participants",
            "tab_choices",
            "tab_quizzes",
            "tab_forums",
            "tab_other_activities",
        ];

        const tabsToRender = allTabs.filter(tab => tab !== activeTab);
        setForceRenderTabs(tabsToRender);

        // Give time for tabs to mount and register graphs
        setTimeout(() => {
            const event = new CustomEvent("trigger-export-all", {
                detail: {format},
            });
            window.dispatchEvent(event);

            // Clear invisible tabs after export
            setTimeout(() => setForceRenderTabs([]), 1000);
        }, 500);
    };

    return (
        <ExportContext.Provider
            value={{
                register,
                unregister,
                getAll,
                forceRenderTabs,
                triggerExportAll,
            }}
        >
            {children}
        </ExportContext.Provider>
    );
};

// Hook to use the context
export const useExportContext = (): ExportContextType => {
    const context = useContext(ExportContext);
    if (!context) {
        throw new Error("useExportContext must be used within an ExportProvider");
    }
    return context;
};