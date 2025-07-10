/**
 * @file QuizzesTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

/*
TODO:
QuizzesTab
Objetivo docente: Visualizar rendimiento del alumnado.

Gráficas sugeridas:
3. Línea: Evolución media de notas (si hay múltiples quizzes).
*/

const QuizzesTab: React.FC = () => {
    const mockQuizzes = [
        {
            activityName: "Quiz 1 – Math Basics",
            topParticipants: [
                {name: "Student A", score: 9.5},
                {name: "Student B", score: 8.7},
                {name: "Student C", score: 8.2},
                {name: "Student D", score: 7.8},
                {name: "Student E", score: 7.5},
            ],
        },
        {
            activityName: "Quiz 2 – Algorithms",
            topParticipants: [
                {name: "Student F", score: 10},
                {name: "Student G", score: 9.8},
                {name: "Student H", score: 9.4},
                {name: "Student I", score: 8.9},
                {name: "Student J", score: 8.3},
            ],
        },
        {
            activityName: "Quiz 3 – Databases",
            topParticipants: [
                {name: "Student K", score: 9.1},
                {name: "Student L", score: 8.9},
                {name: "Student M", score: 8.7},
                {name: "Student N", score: 8.5},
                {name: "Student O", score: 8.2},
            ],
        },
    ];

    // Calcular medias por quiz
    const avgScores = mockQuizzes.map(quiz => {
        const total = quiz.topParticipants.reduce((sum, p) => sum + p.score, 0);
        return parseFloat((total / quiz.topParticipants.length).toFixed(2));
    });

    const quizLabels = mockQuizzes.map(quiz => quiz.activityName);

    const avgLineData = {
        labels: quizLabels,
        datasets: [
            {
                label: "Average Score",
                data: avgScores,
                fill: false,
                borderColor: "rgba(100, 181, 246, 1)",
                backgroundColor: "rgba(100, 181, 246, 0.6)",
                tension: 0.3,
            },
        ],
    };

    return (
        <div>
            {/* Gráficas por quiz */}
            {mockQuizzes.map((quiz, index) => {
                const labels = quiz.topParticipants.map(p => p.name);
                const values = quiz.topParticipants.map(p => p.score);

                const data = {
                    labels,
                    datasets: [
                        {
                            label: "Normalized Score",
                            data: values,
                            backgroundColor: "rgba(249, 128, 18, 0.6)",
                            borderColor: "rgba(249, 128, 18, 1)",
                            borderWidth: 1,
                        },
                    ],
                };

                const options = {
                    indexAxis: "y" as const,
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
                    },
                };

                return (
                    <div key={index}>
                        <GraphBlock
                            title={`${quiz.activityName} – Top 5 Students (Mock Data)`}
                            chartType="bar"
                            data={data}
                            labels={labels}
                            values={values}
                            options={options}
                        />

                        {/* Separador solo si no es el último quiz */}
                        {index < mockQuizzes.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                        )}
                    </div>
                );
            })}

            {/* Separador antes de la línea de evolución */}
            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>

            {/* Gráfica de evolución media */}
            <GraphBlock
                title="Average Score Evolution (Mock Data)"
                chartType="line"
                data={avgLineData}
                labels={quizLabels}
                values={avgScores}
            />
        </div>
    );

};

export default QuizzesTab;
