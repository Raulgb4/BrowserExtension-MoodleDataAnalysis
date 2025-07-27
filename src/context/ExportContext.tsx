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


import {createContext, FC, ReactNode, RefObject, useContext, useRef} from "react";
import type {Chart} from "chart.js";

export interface Exportable {
    chartRef: RefObject<Chart | null>;
    title: string;
    labels: string[];
    values: number[];
}

interface ExportContextType {
    register: (exportable: Exportable) => void;
    unregister: (chartRef: RefObject<Chart | null>) => void;
    getAll: () => Exportable[];
}

const ExportContext = createContext<ExportContextType | undefined>(undefined);

export const ExportProvider: FC<{ children: ReactNode }> = ({children}) => {
    const exportablesRef = useRef<Exportable[]>([]);

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

    return (
        <ExportContext.Provider value={{register, unregister, getAll}}>
            {children}
        </ExportContext.Provider>
    );
};

export const useExportContext = (): ExportContextType => {
    const context = useContext(ExportContext);
    if (!context) {
        throw new Error("useExportContext must be used within an ExportProvider");
    }
    return context;
};
