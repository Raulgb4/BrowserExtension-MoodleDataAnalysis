/**
 * @file GraphBlock.tsx
 *
 * @description
 * Reusable chart wrapper component built on top of react-charts-2 and Chart.js.
 * It renders multiple chart types (pie, bar, line, radar, polarArea, scatter)
 * with a unified layout, responsive behavior, and built-in export capabilities
 * (CSV, PDF, DOCX, PNG/JPEG).
 *
 * The component selects the appropriate Chart.js renderer based on `chartType`,
 * applies sensible per-type defaults, merges custom options, and exposes the
 * underlying chart instance through a ref for export operations. Optional
 * filter/selector controls can be provided via `children`.
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

import {ChartType, computeAxisLimits, computeStepSize, flattenNumbers, truncateText,} from "../utils/chartDataUtils";

// ============================================================================
// 1. Public API & chart configuration (types, component maps, sizes)
// ============================================================================

interface GraphBlockProps {
    title: string;
    chartType: ChartType;
    data: ChartData<ChartType>;
    options?: ChartOptions;
    children?: React.ReactNode; // filters or role selectors
    onPointClick?: (rawPoint: any) => void;
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

const GraphBlock: React.FC<GraphBlockProps> = ({
                                                   title,
                                                   chartType,
                                                   data,
                                                   options,
                                                   children,
                                                   onPointClick,
                                               }) => {

    // =========================================================================
    // 2. Core setup: refs, contexts, responsive behavior, base export data
    // =========================================================================

    const {t} = useTranslation();
    const chartRef = useRef<ChartJS>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const {lastAnalyzedAt} = useAnalysisContext();
    const {register, unregister} = useExportContext();

    // Maneja los clics sobre el canvas del gráfico y dispara onPointClick con el "raw" del punto
    const handleChartClick = (event: any) => {
        if (!onPointClick || !chartRef.current) return;

        const chart = chartRef.current;

        // Usamos el helper de Chart.js para obtener el elemento más cercano clicado
        const points = chart.getElementsAtEventForMode(
            event.nativeEvent,
            "nearest",
            { intersect: true },
            true
        );

        if (!points || points.length === 0) return;

        const firstPoint = points[0];
        const datasetIndex = firstPoint.datasetIndex;
        const index = firstPoint.index;

        const dataset: any = chart.data.datasets?.[datasetIndex];
        const raw = dataset?.data?.[index];

        if (raw) {
            onPointClick(raw);
        }
    };


    /**
     * Observe the container size and trigger a chart resize
     * once the layout has settled. This keeps charts responsive
     * when the side panel or window is resized.
     */
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver(() => {
            if (!chartRef.current) return;
            // Small timeout to avoid thrashing layout while the
            // browser is still resolving flex/grid changes.
            setTimeout(() => chartRef.current?.resize(), 100);
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    /** Resolve chart component and width class */
    const ChartComponent = chartComponents[chartType];
    const chartWidthClass = chartSizes[chartType] || "w-[300px]";

    /**
     * Safe export payload (labels and first dataset numeric values only).
     * This is intentionally conservative to avoid runtime errors when
     * datasets contain mixed or non-numeric values.
     */
    const exportLabels = useMemo<string[]>(() => {
        if (Array.isArray(data.labels) && data.labels.every((l) => typeof l === "string")) {
            return data.labels as string[];
        }
        return [];
    }, [data.labels]);

    const exportValues = useMemo<number[]>(() => {
        const firstDataset = data.datasets?.[0];
        if (
            Array.isArray(firstDataset?.data) &&
            firstDataset.data.every((v: unknown) => typeof v === "number")
        ) {
            return firstDataset.data as number[];
        }
        return [];
    }, [data.datasets]);


    // =========================================================================
    // 3. Scatter export model (rows and headers) & ExportContext registration
    // =========================================================================

    // --- Scatter export support (3-column layout: X, Y, Label) ---
    const isScatter = chartType === "scatter";

    /**
     * Try to read axis titles from the chart options, if available.
     * They will be used as column headers when exporting scatter data.
     * Falls back to generic translated labels for X/Y axes.
     */
    const xAxisTitle = useMemo(() => {
        const explicitTitle =
            (options as any)?.scales?.x?.title?.text ??
            (data as any)?.options?.scales?.x?.title?.text;

        if (explicitTitle) return explicitTitle;
        // Generic fallback (scatter vs non-scatter)
        return isScatter ? t("axis.x") : t("category");
    }, [options, data, isScatter, t]);

    const yAxisTitle = useMemo(() => {
        const explicitTitle =
            (options as any)?.scales?.y?.title?.text ??
            (data as any)?.options?.scales?.y?.title?.text;

        if (explicitTitle) return explicitTitle;
        return isScatter ? t("axis.y") : t("value");
    }, [options, data, isScatter, t]);

    /**
     * Build row-wise data for scatter export: [x, y, label].
     * Only true scatter datasets are considered (regression lines are ignored).
     */
    const scatterRows: (string | number)[][] = useMemo(() => {
        if (!isScatter || !Array.isArray(data?.datasets)) return [];

        type ScatterPointLike = {
            x: number;
            y: number;
            studentName?: string;
            quizName?: string;
            label?: string;
            // Allow extra fields without typing them explicitly
            [key: string]: unknown;
        };

        const rows: (string | number)[][] = [];

        for (const ds of data.datasets as any[]) {
            if (ds?.type !== "scatter" || !Array.isArray(ds?.data)) continue;

            for (const rawPoint of ds.data as ScatterPointLike[]) {
                if (rawPoint) {
                    const label3 =
                        rawPoint.studentName ??
                        rawPoint.quizName ??
                        rawPoint.label ??
                        // As a last resort, use the dataset label
                        ds?.label ??
                        "";

                    rows.push([rawPoint.x, rawPoint.y, label3]);
                }
            }
        }

        return rows;
    }, [isScatter, data]);

    /**
     * Column headers for scatter exports (X, Y, Label).
     * The third column attempts to infer a semantic label based on the
     * main scatter dataset (students, quizzes, ...).
     */
    const scatterHeaders: string[] = useMemo(() => {
        if (!isScatter) return [];

        const mainScatter = (data?.datasets as any[])?.find(
            (d) => d?.type === "scatter"
        );
        const dsLabel = (mainScatter?.label as string) || "";

        // Default to a generic "label" translation
        let thirdCol = t("label");

        if (/student/i.test(dsLabel)) {
            thirdCol = t("legend.students");
        } else if (/quiz/i.test(dsLabel)) {
            thirdCol = t("legend.quizzes");
        }
        // Additional heuristics could be added here if needed

        return [String(xAxisTitle), String(yAxisTitle), thirdCol];
    }, [isScatter, data, xAxisTitle, yAxisTitle, t]);


    /**
     * Export metadata consumed by the ExportContext so this chart can be
     * included in "Export all" operations (combined PDF/DOCX/…).
     *
     * - `labels` / `values`: classic 2-column export (category, value).
     * - `rows` / `headers3`: optional 3-column layout for scatter charts.
     */
    const exportable = useMemo(
        () => ({
            chartRef,
            title,
            labels: exportLabels,
            values: exportValues,
            // Optional: row-wise data for scatter exports (X, Y, label)
            rows: scatterRows,
            headers3: scatterHeaders,
            chartType,
        }),
        [
            chartRef,
            title,
            exportLabels,
            exportValues,
            scatterRows,
            scatterHeaders,
            chartType,
        ]
    );

    /**
     * Register this chart instance in the ExportContext when it is rendered
     * and automatically unregister it when it unmounts or its registration
     * key changes.
     */
    useEffect(() => {
        register(exportable);
        return () => unregister(chartRef);
    }, [exportable, register, unregister, chartRef]);


    // =========================================================================
    // 4. Chart.js axis limits & per-type default options
    // =========================================================================

    /** ---- Y-axis limits helpers (bar/line only) ---- */

    const numericValues = useMemo(
        () => flattenNumbers(data.datasets as { data?: unknown[] }[]),
        [data.datasets]
    );

    const {suggestedMin, suggestedMax} = useMemo(
        () => computeAxisLimits(numericValues),
        [numericValues]
    );

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

    /**
     * Default Chart.js options per chart type.
     *
     * These options provide:
     * - sensible Y-axis limits for bar/line charts (using suggestedMin/Max)
     * - truncated X-axis labels for dense categorical charts
     * - linear axes for scatter plots
     * - simple legend configuration for radar / pie / polarArea
     *
     * Incoming `options` are later merged on top of this object.
     */
    const defaultOptions: ChartOptions = useMemo(() => {
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
                            /**
                             * Use the index to read the original label and
                             * apply truncation so long labels don't break layout.
                             */
                            callback: (val: unknown) => {
                                const idx =
                                    typeof val === "number" ? val : Number(val); // category scale passes the index

                                const raw =
                                    Array.isArray(data.labels) &&
                                    typeof data.labels[idx] === "string"
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

        // Scatter: keep both axes linear; scales tuned by each chart
        if (chartType === "scatter") {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {legend: baseLegend},
                scales: {
                    x: {type: "linear", beginAtZero: true},
                    y: {type: "linear", beginAtZero: true},
                },
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
    }, [chartType, data.labels, suggestedMax]);


    /**
     * Merge per-chart default options with caller-provided overrides.
     *
     * Note:
     * - Top-level properties from `options` override `defaultOptions`.
     * - `scales` are merged shallowly so that callers can customize axes
     *   without losing the sensible defaults defined above.
     */
    const mergedOptions: ChartOptions = useMemo(
        () => ({
            ...defaultOptions,
            ...options,
            scales: {
                ...(defaultOptions.scales ?? {}),
                ...(options?.scales ?? {}),
            },
        }),
        [defaultOptions, options]
    );


    // =========================================================================
    // 5. Export metadata
    // =========================================================================

    /** ---- Export metadata ---- */
    const sanitizedId = `chart-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

    /**
     * Fixed the list of raster formats supported for image export.
     * (SVG is not used here because we export directly from the canvas.)
     */
    const imageFormats: ("png" | "jpeg")[] = ["png", "jpeg"];

    const formattedDate = lastAnalyzedAt
        ? formatDateForExport(lastAnalyzedAt)
        : "unknown";

    // Title is passed as an i18n key; we use the translated version
    // for both on-screen label and exported file names.
    const translatedTitle = t(title);
    const baseFileName = `${translatedTitle}__${formattedDate}`;

    // Default 2-column headers for non-scatter exports
    const headerLabels: [string, string] = [t("category"), t("value")];

    // Chart components from react-chartjs-2 are forwardRef-capable;
    // we cast here to make the ref type explicit for TypeScript.
    const ChartWithRef = ChartComponent as React.ForwardRefExoticComponent<any>;


    // =========================================================================
    // 6. Action handlers
    // =========================================================================

    /**
     * Handlers for export actions (CSV / PDF / DOCX / image).
     * Scatter charts use a row-wise 3-column export, while
     * other charts fall back to the classic 2-column format.
     */
    const handleExportCSV = () => {
        if (isScatter && scatterRows.length > 0) {
            // Row-wise mode for scatter charts
            exportToCSV({
                rows: scatterRows,
                filename: baseFileName,
                headers: scatterHeaders,
            });
        } else {
            // Classic 2-column mode: category / value
            exportToCSV(exportLabels, exportValues, baseFileName, headerLabels);
        }
    };

    const handleExportPDF = () => {
        if (isScatter && scatterRows.length > 0) {
            // Requires exportToPDF to support { rows, headers }
            exportToPDF(chartRef, [], [], `${baseFileName}.pdf`, headerLabels, {
                rows: scatterRows,
                headers: scatterHeaders,
            });
        } else {
            exportToPDF(
                chartRef,
                exportLabels,
                exportValues,
                `${baseFileName}.pdf`,
                headerLabels
            );
        }
    };

    const handleExportDOCX = () => {
        if (isScatter && scatterRows.length > 0) {
            exportToDOCX(
                chartRef,
                [],
                [],
                `${baseFileName}.docx`,
                headerLabels,
                {rows: scatterRows, headers: scatterHeaders}
            )
                .then(() => {
                    // No-op: DOCX generated
                })
                .catch(() => {
                    // Optional: silent catch to avoid unhandled promise warnings
                });
        } else {
            exportToDOCX(
                chartRef,
                exportLabels,
                exportValues,
                `${baseFileName}.docx`,
                headerLabels
            )
                .then(() => {
                    // No-op: DOCX generated
                })
                .catch(() => {
                    // Optional: silent catch
                });
        }
    };

    const handleExportImage = (format: "png" | "jpeg") => {
        exportToImage(chartRef, format, baseFileName);
    };

    // =========================================================================
    // 7. Render
    // =========================================================================

    return (
        <div className="mb-6 relative" role="region" aria-labelledby={sanitizedId}>
            {/* Title + export buttons */}
            <div className="mb-2 flex flex-col gap-2">
                <p
                    id={sanitizedId}
                    className="text-sm sm:text-base font-semibold text-orange-600 tracking-wide
                               bg-orange-100 px-2 py-0.5 rounded shadow-sm inline-block max-w-full
                               break-words text-left"
                >
                    {translatedTitle}
                </p>

                <div className="flex gap-2 flex-wrap justify-end">
                    {/* CSV */}
                    <button
                        onClick={handleExportCSV}
                        title="Download CSV"
                        aria-label="Export chart as CSV"
                        className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded
                                   hover:bg-orange-100 transition text-orange-600 text-xs"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4"/>
                        CSV
                    </button>

                    {/* PDF */}
                    <button
                        onClick={handleExportPDF}
                        title="Download PDF"
                        aria-label="Export chart as PDF"
                        className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded
                                   hover:bg-orange-100 transition text-orange-600 text-xs"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4"/>
                        PDF
                    </button>

                    {/* DOCX */}
                    <button
                        onClick={handleExportDOCX}
                        title="Download DOCX"
                        aria-label="Export chart as DOCX"
                        className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded
                                   hover:bg-orange-100 transition text-orange-600 text-xs"
                    >
                        <DocumentTextIcon className="w-4 h-4"/>
                        DOCX
                    </button>

                    {/* Images (PNG / JPEG) */}
                    {imageFormats.map((format) => (
                        <button
                            key={format}
                            onClick={() => handleExportImage(format)}
                            title={`Download ${format.toUpperCase()}`}
                            aria-label={`Export chart as ${format.toUpperCase()}`}
                            className="flex items-center gap-1 px-2 py-1 border border-orange-500 rounded
                                       hover:bg-orange-100 transition text-orange-600 text-xs"
                        >
                            <PhotoIcon className="w-4 h-4"/>
                            {format.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart canvas */}
            <div ref={containerRef} className={`${chartWidthClass} mx-auto max-w-full`}>
                <ChartWithRef ref={chartRef} data={data} options={mergedOptions} onClick={handleChartClick}/>
            </div>

            {/* Optional filters / role selectors / controls */}
            {children && (
                <div className="my-3 flex flex-wrap justify-center gap-4 text-sm text-gray-700">
                    {children}
                </div>
            )}
        </div>
    );

};

export default GraphBlock;
