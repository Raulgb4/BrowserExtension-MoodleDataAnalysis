/**
 * @file QuizzesTab.tsx
 *
 * @description Displays quiz statistics based on scraped Moodle data.
 * Shows the top 5 students per quiz and the evolution of average scores.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, {useEffect, useState} from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";
import {Quiz} from "../../models/Quiz";
import {calculateAvgNormalizedScores} from "../../utils/chartDataUtils";

const QuizzesTab: React.FC = () => {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [topNByQuiz, setTopNByQuiz] = useState<number[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            const rawQuizzes = result[courseKey]?.quizzes;
            if (!Array.isArray(rawQuizzes)) return;

            const filtered: Quiz[] = rawQuizzes.filter(
                (quiz: any): quiz is Quiz =>
                    quiz &&
                    Array.isArray(quiz.participantStats) &&
                    quiz.participantStats.length > 0
            );

            setQuizzes(filtered);
            setTopNByQuiz(filtered.map(() => 5));
        });
    }, []);

    const handleTopNChange = (index: number, value: number) => {
        setTopNByQuiz((prev) => {
            const updated = [...prev];
            updated[index] = sanitizeTopN(value);
            return updated;
        });
    };

    const sanitizeTopN = (value: number) => Math.max(1, value);

    const avgScores = calculateAvgNormalizedScores(quizzes);

    const quizLabels = quizzes.map((quiz) => quiz.activityName);

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
        <div className="space-y-8">
            {quizzes.map((quiz, index) => {
                const topN = topNByQuiz[index] || 5;

                const getTopParticipantsData = () => {
                    const sorted = [...quiz.participantStats].sort(
                        (a, b) => b.normalizedGrade - a.normalizedGrade
                    );
                    const top = sorted.slice(0, topN);
                    return {
                        labels: top.map((p) => p.participantName),
                        values: top.map((p) => p.normalizedGrade),
                    };
                };

                const {labels, values} = getTopParticipantsData();

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
                    <div key={quiz.id}>
                        <GraphBlock
                            title={`${quiz.activityName} - Top ${topN} students`}
                            chartType="bar"
                            data={data}
                            options={options}
                        >
                            <div className="w-full flex justify-center items-center gap-2 mt-2 text-sm text-gray-700">
                                <label htmlFor={`topN-${quiz.id}`}>Show top</label>
                                <input
                                    id={`topN-${quiz.id}`}
                                    type="number"
                                    min={1}
                                    value={topN}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        handleTopNChange(
                                            index,
                                            Number.isNaN(value) ? 1 : value
                                        );
                                    }}
                                    className="w-16 border rounded px-2 py-1 text-sm text-gray-800"
                                />
                                <span>students</span>
                            </div>
                        </GraphBlock>

                        {index < quizzes.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                        )}
                    </div>
                );
            })}

            {quizzes.length > 0 && (
                <>
                    <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                    <GraphBlock
                        title="Average Score Evolution"
                        chartType="line"
                        data={avgLineData}
                    />
                </>
            )}
        </div>
    );
};

export default QuizzesTab;
