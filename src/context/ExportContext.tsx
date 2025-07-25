// src/context/ExportContext.tsx

import {
    createContext,
    useContext,
    useRef,
    RefObject,
    ReactNode,
    FC
} from "react";
import type { Chart } from "chart.js";

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

export const ExportProvider: FC<{ children: ReactNode }> = ({ children }) => {
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
        <ExportContext.Provider value={{ register, unregister, getAll }}>
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
