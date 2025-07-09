/**
 * @file ChoicesTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */
import {Pie} from "react-chartjs-2";
import React from "react";

const ChoicesTab: React.FC = () => {
    // Datos tontos de ejemplo para una actividad tipo "elección"
    const data = {
        labels: ["Opción A", "Opción B", "Opción C"],
        datasets: [
            {
                label: "Respuestas",
                data: [12, 8, 5],
                backgroundColor: [
                    "rgba(249, 128, 18, 0.6)", // naranja UMA
                    "rgba(249, 186, 75, 0.6)", // tono más claro
                    "rgba(255, 229, 185, 0.6)", // muy claro
                ],
                borderColor: "white",
                borderWidth: 2,
            },
        ],
    };

    return (
        <div>
            <p className="mb-2 font-semibold text-gray-800">
                Resultados de la actividad de elección (ficticia)
            </p>
            <div className="max-w-full px-4">
                <Pie data={data}/>
            </div>
        </div>
    );
};
export default ChoicesTab;
