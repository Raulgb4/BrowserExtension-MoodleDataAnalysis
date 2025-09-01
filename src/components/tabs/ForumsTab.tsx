/**
 * @file ForumsTab.tsx
 *
 * @description ForumsTab displays data about forum participation.
 * It shows the number of subscriptions per forum and a normalized participation score
 * per student based on posts, replies, and views.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, {useEffect, useState} from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";
import {Forum, ForumParticipantData} from "../../models/Forum";
import {ChartData, ChartOptions} from "chart.js";
import {getTopByMetric} from "../../utils/chartDataUtils";
import {useTranslation} from "react-i18next";

const ForumsTab: React.FC = () => {
    const [forums, setForums] = useState<Forum[]>([]);
    const [topNs, setTopNs] = useState<Record<number, number>>({}); // Tracks top-N participants per forum

    const {t} = useTranslation();

    useEffect(() => {
        // Load forums from local storage
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            const rawForums = result[courseKey]?.forums;
            if (!Array.isArray(rawForums)) return;

            // Only include forums with valid participant statistics
            const validForums: Forum[] = rawForums.filter(
                (f: any): f is Forum =>
                    f &&
                    Array.isArray(f.participantsStats) &&
                    f.participantsStats.length > 0
            );

            setForums(validForums);
            const savedTopNs = result["filters_forums_top_n"];
            if (savedTopNs && typeof savedTopNs === "object") {
                setTopNs(savedTopNs);
            } else {
                setTopNs(getInitialTopNs(validForums.length, 10));
            }
        });
    }, []);

    // Initialize a top-N record for each forum index
    const getInitialTopNs = (
        count: number,
        defaultValue: number
    ): Record<number, number> =>
        Array.from({length: count}, () => null).reduce<Record<number, number>>(
            (acc, _, i) => {
                acc[i] = defaultValue;
                return acc;
            },
            {}
        );

    const forumLabels = forums.map((f) => f.activityName);
    const forumSubscriptions = forums.map((f) => f.subscriptions);

    const subsData: ChartData<"bar"> = {
        labels: forumLabels,
        datasets: [
            {
                label: t("legend.subscriptions"),
                data: forumSubscriptions,
                backgroundColor: "rgba(249, 128, 18, 0.6)",
                borderColor: "rgba(249, 128, 18, 1)",
                borderWidth: 1,
            },
        ],
    };

    // Sum total actions for a participant
    const getTotalActivity = (p: ForumParticipantData) =>
        p.discussionsPosted + p.repliesPosted + p.views;

    // Convert raw total to percentage relative to forum TOTAL
    const calculateParticipationPercentage = (
        p: ForumParticipantData,
        forumTotal: number
    ): number => {
        if (forumTotal <= 0) return 0;
        const total = getTotalActivity(p);
        return parseFloat(((total / forumTotal) * 100).toFixed(2));
    };

    const handleTopNChange = (forumId: number, value: number) => {
        setTopNs((prev) => {
            const updated = {
                ...prev,
                [forumId]: value,
            };

            chrome.storage.local.set({
                filters_forums_top_n: updated
            }).then(() => {
                console.log("Saved top-N filters for forums (immediate).");
            });

            return updated;
        });
    };


    return (
        <div>
            {/* Bar chart for forum subscriptions */}
            <GraphBlock
                title={t("chart.subscriptions_per_forum")}
                chartType="bar"
                data={subsData}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>

            {/* Chart for each forum */}
            {forums.map((forum, index) => {
                const topN = topNs[forum.id] || 10;

                const forumTotal =
                    forum.participantsStats.reduce((acc, curr) => acc + getTotalActivity(curr), 0) || 0;

                const {labels, values} = getTopByMetric(
                    forum.participantsStats,
                    topN,
                    (p) => calculateParticipationPercentage(p, forumTotal),
                    (p) => p.participantName
                );

                const data = {
                    labels,
                    datasets: [
                        {
                            label: t("legend.participation_percentage"),
                            data: values,
                            fill: false,
                            borderColor: "rgba(100, 181, 246, 1)",
                            backgroundColor: "rgba(100, 181, 246, 0.6)",
                            tension: 0.3,
                        },
                    ],
                };

                const maxPercent = Math.max(0, ...values);
                const pad = Math.max(1, maxPercent * 0.1);
                const rawUpper = Math.min(100, maxPercent + pad);

                const roundTo = (n: number, step: number) => Math.ceil(n / step) * step;
                const upperBound =
                    rawUpper <= 20 ? roundTo(rawUpper, 2)
                        : rawUpper <= 50 ? roundTo(rawUpper, 5)
                            : roundTo(rawUpper, 10);

                const stepSize =
                    upperBound <= 20 ? 2
                        : upperBound <= 50 ? 5
                            : 10;

                const percentAxisOptions: ChartOptions<"line"> = {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            min: 0,
                            max: upperBound,
                            ticks: {
                                stepSize,
                                callback: (v) => `${v}%`,
                            },
                        },
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
                            },
                        },
                    },
                };

                return (
                    <div key={forum.id}>
                        {/* Line chart for forum activity distribution */}
                        <GraphBlock
                            title={t("chart.forum_top_n", { name: forum.activityName, count: topN })}
                            chartType="line"
                            data={data}
                            options={percentAxisOptions}
                        >
                            {/* Top-N input control */}
                            <div className="flex justify-center mb-4 text-sm text-gray-700">
                                <label className="flex items-center gap-2">
                                    {t("filter.show_top")}
                                    <input
                                        type="number"
                                        min={1}
                                        max={forum.participantsStats.length}
                                        value={topN}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value);
                                            const maxAllowed = forum.participantsStats.length;
                                            const sanitizedValue = Number.isNaN(value)
                                                ? 1
                                                : Math.min(Math.max(1, value), maxAllowed);
                                            handleTopNChange(forum.id, sanitizedValue);
                                        }}
                                        className="w-16 border border-gray-300 rounded px-2 py-1 text-center"
                                    />
                                    {t("label.participants")}
                                </label>
                            </div>
                            {/* Responsive note under the chart explaining participation */}
                            <p
                                role="note"
                                className="mt-1 text-center text-xs sm:text-sm text-gray-600 leading-snug max-w-prose
                                mx-auto px-4 break-words"
                            >
                                <span className="font-medium">{t("legend.participation_percentage")}:</span>{" "}
                                {t("note.participation_definition")}
                            </p>
                        </GraphBlock>

                        {/* Divider between forums */}
                        {index < forums.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ForumsTab;
