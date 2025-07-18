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

interface Forum {
    activityName: string;
    subscriptions: number;
    participantsStats: {
        participantName: string;
        discussionsPosted: number;
        repliesPosted: number;
        views: number;
    }[];
}

const ForumsTab: React.FC = () => {
    const [forums, setForums] = useState<Forum[]>([]);
    const [topNs, setTopNs] = useState<Record<number, number>>({});

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            const course = result[courseKey];
            const realForums = course.forums || [];

            const filtered = realForums.filter(
                (f: any) =>
                    f.participantsStats &&
                    Array.isArray(f.participantsStats) &&
                    f.participantsStats.length > 0
            );

            setForums(filtered);

            const initialTopNs: Record<number, number> = {};
            filtered.forEach((_forum: Forum, i: number) => {
                initialTopNs[i] = 20;
            });
            setTopNs(initialTopNs);
        });
    }, []);

    const forumLabels = forums.map((f) => f.activityName);
    const forumSubscriptions = forums.map((f) => f.subscriptions);

    const subsData = {
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

    return (
        <div>
            <GraphBlock
                title="Subscriptions per Forum"
                chartType="bar"
                data={subsData}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            {forums.map((forum, index) => {
                const topN = topNs[index] || 20;

                const sortedStats = [...forum.participantsStats].sort((a, b) => {
                    const aTotal = a.discussionsPosted + a.repliesPosted + a.views;
                    const bTotal = b.discussionsPosted + b.repliesPosted + b.views;
                    return bTotal - aTotal;
                });

                const topStats = sortedStats.slice(0, topN);
                const participants = topStats.map((p) => p.participantName);

                const maxActivity =
                    Math.max(...topStats.map((p) => p.discussionsPosted + p.repliesPosted + p.views)) || 1;

                const values = topStats.map((p) => {
                    const total = p.discussionsPosted + p.repliesPosted + p.views;
                    return parseFloat(((total / maxActivity) * 100).toFixed(2));
                });

                const data = {
                    labels: participants,
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

                const handleTopNChange = (value: number) => {
                    setTopNs((prev) => ({
                        ...prev,
                        [index]: value,
                    }));
                };

                return (
                    <div key={index}>
                        <GraphBlock
                            title={`${forum.activityName} - Top ${topN} participants`}
                            chartType="line"
                            data={data}
                        >
                            <div className="flex justify-center mb-4 text-sm text-gray-700">
                                <label className="flex items-center gap-2">
                                    Show top
                                    <input
                                        type="number"
                                        min={1}
                                        max={forum.participantsStats.length}
                                        value={topN}
                                        onChange={(e) =>
                                            handleTopNChange(Number(e.target.value))
                                        }
                                        className="w-16 border border-gray-300 rounded px-2 py-1 text-center"
                                    />
                                    participants
                                </label>
                            </div>
                        </GraphBlock>

                        {index < forums.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ForumsTab;
