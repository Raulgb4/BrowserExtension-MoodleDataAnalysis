/**
 * @file ForumsTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */
import {Bar} from "react-chartjs-2";
import React from "react";

const ForumsTab: React.FC = () => {
    const data = {
        labels: ["Alumno A", "Alumno B", "Alumno C", "Alumno D"],
        datasets: [
            {
                label: "Mensajes publicados",
                data: [5, 12, 3, 7],
                backgroundColor: "rgba(249, 128, 18, 0.6)", // naranja UMA
                borderColor: "rgba(249, 128, 18, 1)",
                borderWidth: 1,
            },
        ],
    };

    const options = {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: "Número de mensajes",
                },
            },
        },
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: "Participación en el foro (ficticia)",
            },
        },
    };

    return (
        <div>
            <p className="mb-2 font-semibold text-gray-800">
                Participación de estudiantes en foros (ejemplo)
            </p>
            <div className="w-[300px] mx-auto">
                <Bar data={data} options={options}/>
            </div>
        </div>
    );
};

export default ForumsTab;
