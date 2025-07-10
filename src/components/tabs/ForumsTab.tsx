/**
 * @file ForumsTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

const ForumsTab: React.FC = () => {
    const mockForums = [
        {
            activityName: "Foro de dudas",
            subscriptions: 205,
            participantsStats: [
                {
                    participantName: "Student A",
                    discussionsPosted: 1,
                    repliesPosted: 3,
                    views: 10,
                },
                {
                    participantName: "Student B",
                    discussionsPosted: 0,
                    repliesPosted: 1,
                    views: 5,
                },
            ],
        },
        {
            activityName: "Foro general",
            subscriptions: 192,
            participantsStats: [
                {
                    participantName: "Student A",
                    discussionsPosted: 0,
                    repliesPosted: 2,
                    views: 8,
                },
                {
                    participantName: "Student C",
                    discussionsPosted: 1,
                    repliesPosted: 1,
                    views: 6,
                },
            ],
        },
    ];

    // ─── Gráfica 1: Número de suscripciones por foro ─────────────
    const forumLabels = mockForums.map(f => f.activityName);
    const forumSubscriptions = mockForums.map(f => f.subscriptions);

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
            {/* Gráfica de suscripciones */}
            <GraphBlock
                title="Subscriptions per Forum"
                chartType="bar"
                data={subsData}
                labels={forumLabels}
                values={forumSubscriptions}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            {/* Gráfica por foro: participación individual */}
            {mockForums.map((forum, index) => {
                const participants = forum.participantsStats.map(p => p.participantName);
                const maxActivity = Math.max(
                    ...forum.participantsStats.map(p =>
                        p.discussionsPosted + p.repliesPosted + p.views
                    )
                ) || 1;

                const values = forum.participantsStats.map(p => {
                    const score = p.discussionsPosted + p.repliesPosted + p.views;
                    return parseFloat(((score / maxActivity) * 100).toFixed(2));
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

                return (
                    <div key={index}>
                        <GraphBlock
                            title={`Participation – ${forum.activityName}`}
                            chartType="line"
                            data={data}
                            labels={participants}
                            values={values}
                        />
                        {index < mockForums.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ForumsTab;
