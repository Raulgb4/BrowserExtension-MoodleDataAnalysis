/**
 * @file GraphBlock.tsx
 * @description
 * Reusable React component that renders a Chart.js-based graph (Pie, Bar, Line, or Radar)
 * with built-in export options. It supports rendering chart visualizations with custom titles,
 * configurable sizes, export buttons, and optional custom filters passed as children.
 *
 * The component receives data and configuration props and dynamically chooses
 * the appropriate Chart.js component based on the specified chart type.
 * It also includes a ref to access the chart instance for export functionality.
 *
 * @author Raúl García Balongo
 * @date 2025
 */
import React, {useRef} from "react";
import {Pie, Bar, Line, Radar} from "react-chartjs-2";
import {Chart as ChartJS, ChartOptions} from "chart.js";
import {exportToCSV, exportToPDF, exportToImage} from "../utils/exportUtils";

type ChartType = "pie" | "bar" | "line" | "radar";

interface GraphBlockProps {
    title: string;
    chartType: ChartType;
    data: any;
    labels: string[];
    values: number[];
    options?: ChartOptions;
    children?: React.ReactNode; // Permite filtros personalizados
}

const chartComponents: Record<ChartType, React.ComponentType<any>> = {
    pie: Pie,
    bar: Bar,
    line: Line,
    radar: Radar,
};

const chartSizes: Record<ChartType, string> = {
    pie: "w-[200px]",
    bar: "w-[400px]",
    line: "w-[400px]",
    radar: "w-[350px]",
};

// Utilidad para truncar etiquetas largas
const truncate = (label: string, maxLength = 15): string =>
    label.length > maxLength ? label.slice(0, maxLength) + "…" : label;

const GraphBlock: React.FC<GraphBlockProps> = ({
                                                   title,
                                                   chartType,
                                                   data,
                                                   labels,
                                                   values,
                                                   options,
                                                   children,
                                               }) => {
    const chartRef = useRef<ChartJS>(null);
    const ChartComponent = chartComponents[chartType];
    const chartWidthClass = chartSizes[chartType] || "w-[300px]";

    // Opciones por defecto con truncado en el eje X si es bar o line
    const defaultOptions: ChartOptions = {
        plugins: {
            legend: {
                display: true,
            },
        },
        scales:
            chartType === "bar" || chartType === "line"
                ? {
                    x: {
                        ticks: {
                            callback: function (value, index) {
                                const label = this.getLabelForValue(index);
                                return truncate(label);
                            },
                            maxRotation: 30,
                            minRotation: 0,
                        },
                    },
                }
                : {},
    };

    // Mezclar opciones por defecto con opciones externas
    const mergedOptions: ChartOptions = {
        ...defaultOptions,
        ...options,
        scales: {
            ...(defaultOptions.scales || {}),
            ...(options?.scales || {}),
        },
    };

    return (
        <div className="mb-6">
            <p className="mb-2 text-center font-semibold text-gray-800">{title}</p>

            <div className={`${chartWidthClass} mx-auto`}>
                <ChartComponent ref={chartRef as any} data={data} options={mergedOptions}/>
            </div>

            {children && (
                <div className="mt-3 mb-2 flex flex-wrap justify-center gap-4 text-sm text-gray-700">
                    {children}
                </div>
            )}

            <div className="mt-3 flex justify-center gap-2 flex-wrap">
                <button
                    onClick={() => exportToCSV(labels, values)}
                    title="Download CSV"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                >
                    Export CSV
                </button>
                <button
                    onClick={() => exportToPDF(chartRef, labels, values, `${title}.pdf`)}
                    title="Download PDF"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                >
                    Export PDF
                </button>
                <button
                    onClick={() => exportToImage(chartRef, "png", title)}
                    title="Download PNG"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                >
                    Export PNG
                </button>
                <button
                    onClick={() => exportToImage(chartRef, "jpeg", title)}
                    title="Download JPEG"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                >
                    Export JPEG
                </button>
            </div>
        </div>
    );
};

export default GraphBlock;