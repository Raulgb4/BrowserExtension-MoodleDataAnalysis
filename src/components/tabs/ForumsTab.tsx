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
import {ChartData} from "chart.js";
import {getTopByMetric} from "../../utils/chartDataUtils";

const ForumsTab: React.FC = () => {
    const [forums, setForums] = useState<Forum[]>([]);
    const [topNs, setTopNs] = useState<Record<number, number>>({}); // Tracks top-N participants per forum

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
            setTopNs(getInitialTopNs(validForums.length, 5)); // Initialize top-N values
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
                label: "Subscriptions",
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

    // Convert raw total to percentage relative to max
    const calculateParticipationPercentage = (
        p: ForumParticipantData,
        maxTotal: number
    ): number => {
        const total = getTotalActivity(p);
        return parseFloat(((total / maxTotal) * 100).toFixed(2));
    };

    const handleTopNChange = (forumId: number, value: number) => {
        setTopNs((prev) => ({
            ...prev,
            [forumId]: value,
        }));
    };

    return (
        <div>
            {/* Bar chart for forum subscriptions */}
            <GraphBlock
                title="Subscriptions per Forum"
                chartType="bar"
                data={subsData}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>

            {/* Chart for each forum */}
            {forums.map((forum, index) => {
                const topN = topNs[forum.id] || 20;

                // Get the highest total activity across participants
                const maxTotal =
                    Math.max(...forum.participantsStats.map(getTotalActivity)) || 1;

                // Get top-N participants by activity %
                const {labels, values} = getTopByMetric(
                    forum.participantsStats,
                    topN,
                    (p) => calculateParticipationPercentage(p, maxTotal),
                    (p) => p.participantName
                );

                const data = {
                    labels,
                    datasets: [
                        {
                            label: "Participation (%)",
                            data: values,
                            fill: false,
                            borderColor: "rgba(100, 181, 246, 1)",
                            backgroundColor: "rgba(100, 181, 246, 0.6)",
                            tension: 0.3,
                        },
                    ],
                };

                return (
                    <div key={forum.id}>
                        {/* Line chart for forum activity distribution */}
                        <GraphBlock
                            title={`${forum.activityName} - Top ${topN} participants`}
                            chartType="line"
                            data={data}
                        >
                            {/* Top-N input control */}
                            <div className="flex justify-center mb-4 text-sm text-gray-700">
                                <label className="flex items-center gap-2">
                                    Show top
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
                                    participants
                                </label>
                            </div>
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
