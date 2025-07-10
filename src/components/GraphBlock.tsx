import React from "react";
import { Pie, Bar, Line, Radar } from "react-chartjs-2";
import { ChartOptions } from "chart.js";
import { exportToCSV } from "../utils/exportUtils";

type ChartType = "pie" | "bar" | "line" | "radar";

interface GraphBlockProps {
    title: string;
    chartType: ChartType;
    data: any;
    labels: string[];
    values: number[];
    options?: ChartOptions;
}

const GraphBlock: React.FC<GraphBlockProps> = ({ title, chartType, data, labels, values, options }) => {
    const ChartComponent =
        chartType === "pie"
            ? Pie
            : chartType === "bar"
                ? Bar
                : chartType === "line"
                    ? Line
                    : Radar;

    const chartSizes: Record<ChartType, string> = {
        pie: "w-[200px]",
        bar: "w-[350px]",
        line: "w-[350px]",
        radar: "w-[300px]",
    };

    const chartWidthClass = chartSizes[chartType] || "w-[250px]";

    return (
        <div className="mb-6">
            <p className="mb-2 text-center font-semibold text-gray-800">{title}</p>

            <div className={`${chartWidthClass} mx-auto`}>
                <ChartComponent data={data} options={options as any} />
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
                    title="Download PDF"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                    disabled
                >
                    Export PDF
                </button>

                <button
                    title="Download PNG"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                    disabled
                >
                    Export PNG
                </button>
            </div>
        </div>
    );
};

export default GraphBlock;
