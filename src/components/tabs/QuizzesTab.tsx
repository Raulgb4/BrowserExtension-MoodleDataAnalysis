import { Bar } from "react-chartjs-2";

const QuizzesTab: React.FC = () => {
    const data = {
        labels: ["Alumno A", "Alumno B", "Alumno C", "Alumno D"],
        datasets: [
            {
                label: "Puntuación",
                data: [8.5, 7.0, 9.2, 6.8],
                backgroundColor: "rgba(249, 128, 18, 0.6)", // naranja UMA
                borderColor: "rgba(249, 128, 18, 1)",
                borderWidth: 1,
            },
        ],
    };

    const options = {
        indexAxis: "y" as const, // 🔁 barras horizontales
        scales: {
            x: {
                beginAtZero: true,
                max: 10,
            },
        },
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: "Notas del cuestionario (ficticias)",
            },
        },
    };

    return (
        <div>
            <p className="mb-2 font-semibold text-gray-800">
                Resultados de un cuestionario de ejemplo
            </p>
            <div className="w-[300px] mx-auto">
                <Bar data={data} options={options} />
            </div>
        </div>
    );
};

export default QuizzesTab;
