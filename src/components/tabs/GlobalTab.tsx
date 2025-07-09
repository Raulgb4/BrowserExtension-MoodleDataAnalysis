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
            <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-gray-800">Participación global</p>
                <button
                    onClick={() => exportToCSV(labels, values)}
                    title="Descargar CSV"
                    className="text-sm text-white bg-orange-500 hover:bg-orange-600 px-2 py-1 rounded transition"
                >
                    Exportar CSV
                </button>
            </div>
            <Bar data={data} />
        </div>
    );
};

export default GlobalTab;
