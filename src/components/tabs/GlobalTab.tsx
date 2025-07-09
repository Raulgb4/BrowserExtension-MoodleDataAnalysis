import "../../chartConfig";
import { Bar } from "react-chartjs-2";
import React from "react";
import { exportToCSV } from "../../utils/exportUtils";



const GlobalTab: React.FC = () => {
    const labels = ["A", "B", "C"];
    const values = [12, 19, 3];

    const data = {
        labels,
        datasets: [
            {
                label: "Participación",
                data: values,
                backgroundColor: "rgba(249, 128, 18, 0.6)",
            },
        ],
    };

    return (
        <div>
            <p className="mb-2 font-semibold text-gray-800">Participación global</p>

            <Bar data={data} />

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
                >
                    Exportar PDF
                </button>

                <button
                    title="Descargar PNG"
                    className="text-xs text-orange-600 border border-orange-500 hover:bg-orange-100 px-2 py-0.5 rounded transition"
                >
                    Exportar PNG
                </button>
            </div>
        </div>
    );
};

export default GlobalTab;
