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

import React, {useEffect, useMemo, useRef} from "react";
import {Bar, Line, Pie, PolarArea, Radar, Scatter} from "react-chartjs-2";
import {Chart as ChartJS, ChartData, ChartOptions} from "chart.js";
import {exportToCSV, exportToDOCX, exportToImage, exportToPDF, formatDateForExport} from "../utils/exportUtils";
import {ArrowDownTrayIcon, DocumentArrowDownIcon, PhotoIcon,} from "@heroicons/react/24/outline";
import {useAnalysisContext} from "../context/AnalysisContext";
import {useTranslation} from "react-i18next";
import {DocumentTextIcon} from "@heroicons/react/16/solid";
import {useExportContext} from "../context/ExportContext";

type ChartType = "pie" | "bar" | "line" | "radar" | "polarArea" | "scatter";

interface GraphBlockProps {
    title: string;
    chartType: ChartType;
    data: ChartData<ChartType>;
    options?: ChartOptions;
    children?: React.ReactNode; // filters or role selectors
}

const chartComponents: Record<ChartType, React.ComponentType<any>> = {
    pie: Pie,
    bar: Bar,
    line: Line,
    radar: Radar,
    polarArea: PolarArea,
    scatter: Scatter,
};

const chartSizes: Record<ChartType, string> = {
    pie: "w-64 h-64",
    bar: "w-full max-w-6xl h-[380px]",
    line: "w-full max-w-6xl h-[380px]",
    radar: "w-96",
    polarArea: "w-96 h-96",
    scatter: "w-full max-w-6xl h-[380px]",
};

//const truncate = (label: string, maxLength = 15): string =>
//    label.length > maxLength ? label.slice(0, maxLength) + "…" : label;

const GraphBlock: React.FC<GraphBlockProps> = ({
                                                   title,
                                                   chartType,
                                                   data,
                                                   options,
                                                   children,
                                               }) => {
    const {t} = useTranslation();
    const chartRef = useRef<ChartJS>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const {lastAnalyzedAt} = useAnalysisContext();
    const {register, unregister} = useExportContext();

    /** Truncate helper for axis labels */
    const truncateText = (text: string, max = 15) =>
        text.length > max ? `${text.slice(0, max - 1)}…` : text;

    /** Observe container size and trigger chart resize after the layout settles */
    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (!chartRef.current) return;
            setTimeout(() => chartRef.current?.resize(), 100);
        });
        const el = containerRef.current;
        if (el) observer.observe(el);
        return () => observer.disconnect();
    }, []);

    /** Resolve chart component and width class */
    const ChartComponent = chartComponents[chartType];
    const chartWidthClass = chartSizes[chartType] || "w-[300px]";

    /** Safe export payload (labels and first dataset values only) */
    const exportLabels =
        Array.isArray(data.labels) && data.labels.every((l) => typeof l === "string")
            ? (data.labels as string[])
            : [];

    const exportValues =
        Array.isArray(data.datasets?.[0]?.data) &&
        data.datasets[0].data.every((v: unknown) => typeof v === "number")
            ? (data.datasets[0].data as number[])
            : [];






    // === NUEVO: soporte de exportación para SCATTER (3 columnas) ===
    const isScatter = chartType === "scatter";

    // Intenta leer títulos de ejes si existen, para usarlos como cabeceras
    const xAxisTitle =
        (options as any)?.scales?.x?.title?.text ||
        (data as any)?.options?.scales?.x?.title?.text ||
        // fallback traducido genérico
        (isScatter ? t("axis.x") : t("category"));

    const yAxisTitle =
        (options as any)?.scales?.y?.title?.text ||
        (data as any)?.options?.scales?.y?.title?.text ||
        (isScatter ? t("axis.y") : t("value"));

    // Construye filas a partir de los datasets tipo scatter (ignora la recta de regresión)
    const scatterRows: (string | number)[][] = useMemo(() => {
        if (!isScatter || !Array.isArray(data?.datasets)) return [];

        const rows: (string | number)[][] = [];
        for (const ds of data.datasets as any[]) {
            if (ds?.type !== "scatter" || !Array.isArray(ds?.data)) continue;
            for (const p of ds.data) {
                if (p && typeof p.x === "number" && typeof p.y === "number") {
                    const label3 =
                        p.studentName ??
                        p.quizName ??
                        p.label ??
                        // si quieres, usa el label del dataset como 3ª columna por defecto
                        ds?.label ??
                        "";
                    rows.push([p.x, p.y, label3]);
                }
            }
        }
        return rows;
    }, [isScatter, data]);

    // Cabeceras para 3 columnas; la tercera intenta inferirse del label del dataset principal
    const scatterHeaders: string[] = useMemo(() => {
        if (!isScatter) return [];
        // Intenta detectar si el dataset principal representa "students", "quizzes", etc.
        const mainScatter = (data?.datasets as any[])?.find((d) => d?.type === "scatter");
        const dsLabel = (mainScatter?.label as string) || "";
        let thirdCol = t("label");
        if (/student/i.test(dsLabel)) thirdCol = t("legend.students");
        else if (/quiz/i.test(dsLabel)) thirdCol = t("legend.quizzes");
        // añade más heurísticas si quieres
        return [String(xAxisTitle), String(yAxisTitle), thirdCol];
    }, [isScatter, data, xAxisTitle, yAxisTitle, t]);

    // ... (sigue igual: register/unregister, defaults, etc.)

    // (Opcional) registra también rows + headers para "Export All" si tu contexto lo admite
    const exportable = useMemo(
        () => ({
            chartRef,
            title,
            labels: exportLabels,
            values: exportValues,
            // nuevos opcionales:
            rows: scatterRows,
            headers3: scatterHeaders,
            chartType,
        }),
        [title, exportLabels, exportValues, scatterRows, scatterHeaders, chartType]
    );

    useEffect(() => {
        register(exportable);
        return () => unregister(chartRef);
    }, [exportable, register, unregister]);

    /** ---- Y‑axis limits helpers (bar/line only) ---- */

    // Collect numeric values from all datasets
    function flattenNumbers(datasets?: { data?: unknown[] }[]): number[] {
        if (!datasets) return [];
        const out: number[] = [];
        for (const ds of datasets) {
            for (const v of (ds.data ?? []) as (number | null | undefined)[]) {
                if (typeof v === "number" && Number.isFinite(v)) out.push(v);
            }
        }
        return out;
    }

    // Compute min/max with 5% padding; clamp min to 0
    function computeAxisLimits(values: number[]) {
        if (values.length === 0) return {suggestedMin: 0, suggestedMax: 1};

        const min = Math.min(...values);
        const max = Math.max(...values);

        if (min === max) {
            // Keep axis readable even with a flat line; never below zero
            return {suggestedMin: Math.max(0, min - 1), suggestedMax: max + 1};
        }

        const range = max - min;
        const pad = range * 0.05;
        return {
            suggestedMin: Math.max(0, min - pad),
            suggestedMax: max + pad,
        };
    }

    function computeStepSize(max: number, targetTicks = 8) {
        return Math.max(1, Math.ceil(max / targetTicks));
    }

    const numericValues = flattenNumbers(data.datasets as { data?: unknown[] }[]);
    const {suggestedMin, suggestedMax} = computeAxisLimits(numericValues);

    /** ---- Default chart options (merged with incoming `options`) ---- */
    const baseLegend = {
        display: true,
        position: "top" as const,
        labels: {
            boxWidth: 12,
            boxHeight: 12,
            padding: 8,
            usePointStyle: true,
            textAlign: "center" as const,
        },
    };

    const defaultOptions: ChartOptions = (() => {
        // Cartesian charts: bar / line
        if (chartType === "bar" || chartType === "line") {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {legend: baseLegend},
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMin,
                        suggestedMax,
                        bounds: "ticks",
                        grace: "10%",
                        ticks: {
                            stepSize: computeStepSize(suggestedMax),
                            maxTicksLimit: 10,
                        },
                    },
                    x: {
                        ticks: {
                            // Use index to read the original label and truncate it
                            callback: (val: unknown) => {
                                const idx =
                                    typeof val === "number"
                                        ? val
                                        : Number(val); // category scale passes the index
                                const raw =
                                    Array.isArray(data.labels) && typeof data.labels[idx] === "string"
                                        ? (data.labels[idx] as string)
                                        : String(val);
                                return truncateText(raw, 15);
                            },
                            maxRotation: 30,
                            minRotation: 0,
                            autoSkip: true,
                        } as any,
                    },
                },
            };
        }

        if (chartType === "scatter") {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: baseLegend },
                scales: {
                    x: { type: "linear", beginAtZero: true },
                    y: { type: "linear", beginAtZero: true }
                }
            };
        }

        // Radar (radial). We keep defaults; tune r.suggestedMin/Max if needed.
        if (chartType === "radar") {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {legend: baseLegend},
            };
        }

        // Pie / polarArea (no Y axis) — keep an aspect ratio so they stay large and round
        return {
            responsive: true,
            maintainAspectRatio: true,  // was false -> could shrink with container height
            aspectRatio: 1,             // square canvas to match w-*/h-* above
            plugins: {legend: baseLegend},
        };
    })();

    // Merge defaults with per‑chart overrides while preserving scales
    const mergedOptions: ChartOptions = {
        ...defaultOptions,
        ...options,
        scales: {
            ...(defaultOptions.scales ?? {}),
            ...(options?.scales ?? {}),
        },
    };

    /** ---- Export metadata ---- */
    const sanitizedId = `chart-title-${title.replace(/\s+/g, "-").toLowerCase()}`;
    const imageFormats: ("png" | "jpeg")[] = ["png", "jpeg"];
    const formattedDate = lastAnalyzedAt ? formatDateForExport(lastAnalyzedAt) : "unknown";
    const translatedTitle = t(title);
    const baseFileName = `${translatedTitle}__${formattedDate}`;
    const headerLabels: [string, string] = [t("category"), t("value")];

    // Chart components are already forward‑ref capable in the map
    const ChartWithRef = ChartComponent as React.ForwardRefExoticComponent<any>;

    return (
        <div className="mb-6 relative" role="region" aria-labelledby={sanitizedId}>
            {/* Title y botones */}
            <div className="mb-2 flex flex-col gap-2">
                <p id={sanitizedId} className="text-sm sm:text-base font-semibold text-orange-600 tracking-wide
           bg-orange-100 px-2 py-0.5 rounded shadow-sm inline-block max-w-full break-words text-left">
                    {translatedTitle}
                </p>

                <div className="flex gap-2 flex-wrap justify-end">
                    {/* CSV */}
                    <button
                        onClick={() => {
                            if (isScatter && scatterRows.length > 0) {
                                // NUEVO modo por filas
                                exportToCSV({
                                    rows: scatterRows,
                                    filename: baseFileName,
                                    headers: scatterHeaders,
                                });
                            } else {
                                // Modo clásico 2 columnas
                                exportToCSV(exportLabels, exportValues, baseFileName, headerLabels);
                            }
                        }}
                        title="Download CSV"
                        aria-label="Export chart as CSV"
                        className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded
                       hover:bg-orange-100 transition text-orange-600 text-xs"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        CSV
                    </button>

                    {/* PDF */}
                    <button
                        onClick={() => {
                            if (isScatter && scatterRows.length > 0) {
                                // requiere el mismo patrón en exportToPDF (soporte de { rows, headers })
                                exportToPDF(chartRef, [], [], `${baseFileName}.pdf`, headerLabels, {
                                    rows: scatterRows,
                                    headers: scatterHeaders,
                                });
                            } else {
                                exportToPDF(chartRef, exportLabels, exportValues, `${baseFileName}.pdf`, headerLabels);
                            }
                        }}
                        title="Download PDF"
                        aria-label="Export chart as PDF"
                        className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded
                       hover:bg-orange-100 transition text-orange-600 text-xs"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        PDF
                    </button>

                    {/* DOCX */}
                    <button
                        onClick={() => {
                            if (isScatter && scatterRows.length > 0) {
                                // requiere el mismo patrón en exportToDOCX (soporte de { rows, headers })
                                exportToDOCX(chartRef, [], [], `${baseFileName}.docx`, headerLabels, {
                                    rows: scatterRows,
                                    headers: scatterHeaders,
                                });
                            } else {
                                exportToDOCX(chartRef, exportLabels, exportValues, `${baseFileName}.docx`, headerLabels);
                            }
                        }}
                        title="Download DOCX"
                        aria-label="Export chart as DOCX"
                        className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded
                       hover:bg-orange-100 transition text-orange-600 text-xs"
                    >
                        <DocumentTextIcon className="w-4 h-4" />
                        DOCX
                    </button>

                    {imageFormats.map((format) => (
                        <button
                            key={format}
                            onClick={() => exportToImage(chartRef, format, baseFileName)}
                            title={`Download ${format.toUpperCase()}`}
                            aria-label={`Export chart as ${format.toUpperCase()}`}
                            className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded
                         hover:bg-orange-100 transition text-orange-600 text-xs"
                        >
                            <PhotoIcon className="w-4 h-4" />
                            {format.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div ref={containerRef} className={`${chartWidthClass} mx-auto max-w-full`}>
                <ChartWithRef ref={chartRef} data={data} options={mergedOptions} />
            </div>

            {children && (
                <div className="my-3 flex flex-wrap justify-center gap-4 text-sm text-gray-700">
                    {children}
                </div>
            )}
        </div>
    );
};

export default GraphBlock;
