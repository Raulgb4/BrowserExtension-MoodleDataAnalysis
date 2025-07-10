/**
 * @file GlobalTab.tsx
 *
 * @description
 * Displays bar charts for additional Moodle activities: URL resources, files, and workshops.
 * Uses the reusable GraphBlock component for consistent layout and export functionality.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

const GlobalTab: React.FC = () => {
    const activityName = ["Choices", "Quizzes", "Forums", "URL Resources", "Resources", "Workshops"];

    // Total number of visits per activity type (mock)
    const numViews = [64, 105, 89, 74, 52, 38];

    // Number of unique users who accessed each activity (mock)
    const numUsers = [25, 35, 42, 30, 28, 19];

    // Last access timestamps (mock, hace X días)
    const lastAccess = [
        Date.now() - 1000 * 60 * 60 * 24 * 3,   // 3 días
        Date.now() - 1000 * 60 * 60 * 24 * 15,  // 15 días
        Date.now() - 1000 * 60 * 60 * 24 * 1,   // 1 día
        Date.now() - 1000 * 60 * 60 * 24 * 40,  // 40 días
        Date.now() - 1000 * 60 * 60 * 24 * 10,  // 10 días
        Date.now() - 1000 * 60 * 60 * 24 * 5,   // 5 días
    ];

    const avgViewsPerUser = numViews.map((views, i) =>
        numUsers[i] !== 0 ? parseFloat((views / numUsers[i]).toFixed(2)) : 0
    );

    const daysSinceLastAccess = lastAccess.map(ts =>
        Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24))
    );

    const totalViewsData = {
        labels: activityName,
        datasets: [
            {
                label: "Total Visits",
                data: numViews,
                backgroundColor: "rgba(249, 128, 18, 0.6)",
                borderColor: "rgba(249, 128, 18, 1)",
                borderWidth: 1,
            },
        ],
    };

    const avgViewsData = {
        labels: activityName,
        datasets: [
            {
                label: "Average Views per User",
                data: avgViewsPerUser,
                fill: false,
                borderColor: "rgba(100, 181, 246, 1)",
                backgroundColor: "rgba(100, 181, 246, 0.6)",
                tension: 0.3,
            },
        ],
    };

    const lastAccessData = {
        labels: activityName,
        datasets: [
            {
                label: "Days Since Last Access",
                data: daysSinceLastAccess,
                backgroundColor: "rgba(255, 99, 132, 0.2)",
                borderColor: "rgba(255, 99, 132, 1)",
                borderWidth: 1,
                pointBackgroundColor: "rgba(255, 99, 132, 1)",
                fill: true,
            },
        ],
    };

    return (
        <div>
            <GraphBlock
                title="Total Visits by Activity Type (Mock Data)"
                chartType="bar"
                data={totalViewsData}
                labels={activityName}
                values={numViews}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            <GraphBlock
                title="Average Views per User (Mock Data)"
                chartType="line"
                data={avgViewsData}
                labels={activityName}
                values={avgViewsPerUser}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            <GraphBlock
                title="Days Since Last Access (Mock Data)"
                chartType="radar"
                data={lastAccessData}
                labels={activityName}
                values={daysSinceLastAccess}
            />
        </div>
    );
};

export default GlobalTab;
