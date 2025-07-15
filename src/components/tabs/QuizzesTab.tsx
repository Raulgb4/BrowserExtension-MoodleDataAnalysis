/**
 * @file QuizzesTab.tsx
 *
 * @description Displays quiz statistics based on scraped Moodle data.
 * Shows the top 5 students per quiz and the evolution of average scores.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, { useEffect, useState } from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

interface Quiz {
    activityName: string;
    participantStats: {
        participantId: number;
        participantName: string;
        grade: number;
        normalizedGrade: number;
        duration: number;
    }[];
}

const QuizzesTab: React.FC = () => {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [topNByQuiz, setTopNByQuiz] = useState<number[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            const course = result[courseKey];
            const realQuizzes = course.quizzes || [];

            const filtered = realQuizzes.filter(
                (q: any) =>
                    q.participantStats &&
                    Array.isArray(q.participantStats) &&
                    q.participantStats.length > 0
            );

            setQuizzes(filtered);
            setTopNByQuiz(filtered.map(() => 5)); // Por defecto top 5
        });
    }, []);

    const handleTopNChange = (index: number, value: number) => {
        setTopNByQuiz((prev) => {
            const updated = [...prev];
            updated[index] = Math.max(1, value); // mínimo 1
            return updated;
        });
    };

    const quizLabels = quizzes.map((quiz) => quiz.activityName);

    const avgScores = quizzes.map((quiz) => {
        const total = quiz.participantStats.reduce(
            (sum, p) => sum + p.normalizedGrade,
            0
        );
        return parseFloat((total / quiz.participantStats.length).toFixed(2));
    });

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
            {quizzes.map((quiz, index) => {
                const topN = topNByQuiz[index] || 5;

                const topParticipants = [...quiz.participantStats]
                    .sort((a, b) => b.normalizedGrade - a.normalizedGrade)
                    .slice(0, topN);

                const labels = topParticipants.map((p) => p.participantName);
                const values = topParticipants.map((p) => p.normalizedGrade);

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
                            title={`${quiz.activityName} – Top ${topN} Students`}
                            chartType="bar"
                            data={data}
                            labels={labels}
                            values={values}
                            options={options}
                        >
                            <div className="w-full flex justify-center items-center gap-2 mt-2 text-sm text-gray-700">
                                <label htmlFor={`topN-${index}`}>
                                    Show top
                                </label>
                                <input
                                    id={`topN-${index}`}
                                    type="number"
                                    min={1}
                                    value={topN}
                                    onChange={(e) =>
                                        handleTopNChange(index, parseInt(e.target.value) || 1)
                                    }
                                    className="w-16 border rounded px-2 py-1 text-sm text-gray-800"
                                />
                                <span>students</span>
                            </div>
                        </GraphBlock>

                        {index < quizzes.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
                        )}
                    </div>
                );
            })}

            {quizzes.length > 0 && (
                <>
                    <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
                    <GraphBlock
                        title="Average Score Evolution"
                        chartType="line"
                        data={avgLineData}
                        labels={quizLabels}
                        values={avgScores}
                    />
                </>
            )}
        </div>
    );
};

export default QuizzesTab;
