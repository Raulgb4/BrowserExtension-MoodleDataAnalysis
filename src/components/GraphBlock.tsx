import React, { useRef } from "react";
import { Pie, Bar, Line, Radar } from "react-chartjs-2";
import { Chart as ChartJS, ChartOptions } from "chart.js";
import { exportToCSV, exportToImage, exportToPDF } from "../utils/exportUtils";

type ChartType = "pie" | "bar" | "line" | "radar";

interface GraphBlockProps {
    title: string;
    chartType: ChartType;
    data: any;
    labels: string[];
    values: number[];
    options?: ChartOptions;
}

const GraphBlock: React.FC<GraphBlockProps> = ({
                                                   title,
                                                   chartType,
                                                   data,
                                                   labels,
                                                   values,
                                                   options,
                                               }) => {
    const chartSizes: Record<ChartType, string> = {
        pie: "w-[200px]",
        bar: "w-[350px]",
        line: "w-[350px]",
        radar: "w-[300px]",
    };

    const chartWidthClass = chartSizes[chartType] || "w-[250px]";

    // Ref específico según el tipo de gráfico
    const chartRef = useRef<ChartJS>(null);

    const renderChart = () => {
        switch (chartType) {
            case "pie":
                return <Pie ref={chartRef as any} data={data} options={options as any} />;
            case "bar":
                return <Bar ref={chartRef as any} data={data} options={options as any} />;
            case "line":
                return <Line ref={chartRef as any} data={data} options={options as any} />;
            case "radar":
                return <Radar ref={chartRef as any} data={data} options={options as any} />;
            default:
                return null;
        }
    };

    return (
        <div className="mb-6">
            <p className="mb-2 text-center font-semibold text-gray-800">{title}</p>

            <div className={`${chartWidthClass} mx-auto`}>
                {renderChart()}
            </div>

            <div className="mt-3 flex justify-center gap-2">
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
