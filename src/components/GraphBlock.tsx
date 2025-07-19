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
import {Chart as ChartJS, ChartData, ChartOptions} from "chart.js";
import {exportToCSV, exportToPDF, exportToImage} from "../utils/exportUtils";
import {
    DocumentArrowDownIcon,
    ArrowDownTrayIcon,
    PhotoIcon,
} from "@heroicons/react/24/outline";

type ChartType = "pie" | "bar" | "line" | "radar";

interface GraphBlockProps {
    title: string;
    chartType: ChartType;
    data: ChartData<ChartType>;
    options?: ChartOptions;
    children?: React.ReactNode; // filters or role selectors
}

// Chart components by type
const chartComponents: Record<ChartType, React.ComponentType<any>> = {
    pie: Pie,
    bar: Bar,
    line: Line,
    radar: Radar,
};

// Max chart width per type
const chartSizes: Record<ChartType, string> = {
    pie: "w-64",
    bar: "w-full max-w-4xl",
    line: "w-full max-w-4xl",
    radar: "w-96",
};

// Truncate long labels for X-axis
const truncate = (label: string, maxLength = 15): string =>
    label.length > maxLength ? label.slice(0, maxLength) + "…" : label;

const GraphBlock: React.FC<GraphBlockProps> = ({
                                                   title,
                                                   chartType,
                                                   data,
                                                   options,
                                                   children,
                                               }) => {
    const chartRef = useRef<ChartJS>(null);
    const ChartComponent = chartComponents[chartType];
    const chartWidthClass = chartSizes[chartType] || "w-[300px]";

    // Validate and extract labels/values for export
    const exportLabels = Array.isArray(data.labels) && data.labels.every(l => typeof l === "string")
        ? data.labels as string[]
        : [];

    const exportValues = Array.isArray(data.datasets?.[0]?.data) && data.datasets[0].data.every(v => typeof v === "number")
        ? data.datasets[0].data as number[]
        : [];

    // Default chart options for bar/line
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
                            callback: function (_, index) {
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

    // Merge default and custom options
    const mergedOptions: ChartOptions = {
        ...defaultOptions,
        ...options,
        scales: {
            ...(defaultOptions.scales ?? {}),
            ...(options?.scales ?? {}),
        },
    };

    // For a11y
    const sanitizedId = `chart-title-${title.replace(/\s+/g, "-").toLowerCase()}`;
    const imageFormats: ("png" | "jpeg")[] = ["png", "jpeg"];
    const ChartWithRef = ChartComponent as React.ForwardRefExoticComponent<any>;

    return (
        <div className="mb-6 relative" role="region" aria-labelledby={sanitizedId}>
            {/* Title and export buttons */}
            <div className="mb-2 flex flex-col gap-2">
                <p
                    id={sanitizedId}
                    className="text-sm sm:text-base font-semibold text-orange-600 tracking-wide
                    bg-orange-100 px-2 py-0.5 rounded shadow-sm inline-block max-w-full break-words text-left"
                >
                    {title}
                </p>

                <div className="flex gap-2 flex-wrap justify-end">
                    {/* CSV export */}
                    <button
                        onClick={() => exportToCSV(exportLabels, exportValues, title)}
                        title="Download CSV"
                        aria-label="Export chart as CSV"
                        className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded hover:bg-orange-100 transition text-orange-600 text-xs"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        CSV
                    </button>

                    {/* PDF export */}
                    <button
                        onClick={() => exportToPDF(chartRef, exportLabels, exportValues, `${title}.pdf`)}
                        title="Download PDF"
                        aria-label="Export chart as PDF"
                        className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded hover:bg-orange-100 transition text-orange-600 text-xs"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        PDF
                    </button>

                    {/* Image exports */}
                    {imageFormats.map((format) => (
                        <button
                            key={format}
                            onClick={() => exportToImage(chartRef, format, title)}
                            title={`Download ${format.toUpperCase()}`}
                            aria-label={`Export chart as ${format.toUpperCase()}`}
                            className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded hover:bg-orange-100 transition text-orange-600 text-xs"
                        >
                            <PhotoIcon className="w-4 h-4" />
                            {format.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div className={`${chartWidthClass} mx-auto`}>
                <ChartWithRef ref={chartRef} data={data} options={mergedOptions} />
            </div>

            {/* Optional children (filters or controls) */}
            {children && (
                <div className="my-3 flex flex-wrap justify-center gap-4 text-sm text-gray-700">
                    {children}
                </div>
            )}
        </div>
    );
};

export default GraphBlock;
