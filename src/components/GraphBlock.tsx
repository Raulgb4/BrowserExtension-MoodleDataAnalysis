import React from "react";
import {Pie, Bar, Line} from "react-chartjs-2"; // importa los necesarios
import {exportToCSV} from "../utils/exportUtils";

type ChartType = "pie" | "bar" | "line";

interface GraphBlockProps {
    title: string;
    chartType: ChartType;
    data: any;
    labels: string[];
    values: number[];
}

const GraphBlock: React.FC<GraphBlockProps> = ({title, chartType, data, labels, values}) => {
    const ChartComponent = chartType === "pie" ? Pie : chartType === "bar" ? Bar : Line;

    // Tamaños configurables por tipo de gráfico
    const chartSizes: Record<string, string> = {
        pie: "w-[200px]",
        bar: "w-[300px]",
        line: "w-[350px]",
    };

    const chartWidthClass = chartSizes[chartType] || "w-[250px]"; // fallback por si se pasa uno no definido

    return (
        <div className="mb-6">
            <p className="mb-2 text-center font-semibold text-gray-800">{title}</p>

            <div className={`${chartWidthClass} mx-auto`}>
                <ChartComponent data={data}/>
            </div>
            <div className="mt-3 flex justify-center gap-2">
                <button
                    onClick={() => exportToCSV(labels, values)}
                    title="Descargar CSV"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                >
                    Exportar CSV
                </button>

                <button
                    title="Descargar PDF"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                    disabled
                >
                    Exportar PDF
                </button>

                <button
                    title="Descargar PNG"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                    disabled
                >
                    Exportar PNG
                </button>
            </div>
        </div>
    );
};

export default GraphBlock;
