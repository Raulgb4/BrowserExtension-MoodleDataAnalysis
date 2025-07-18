/**
 * @file GlobalTab.tsx
 *
 * @description
 * Displays aggregated course statistics using real scraped data from Chrome local storage.
 * It visualizes three key metrics for each activity type (choices, quizzes, forums, etc.):
 * - Total number of visits
 * - Average views per user
 * - Days since last access
 * Data is extracted dynamically and presented through bar, line, and radar charts.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, {useEffect, useState} from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

const activityTypes = [
    {key: "choices", label: "Choices"},
    {key: "quizzes", label: "Quizzes"},
    {key: "forums", label: "Forums"},
    {key: "urlResources", label: "URL Resources"},
    {key: "resources", label: "Resources"},
    {key: "workshops", label: "Workshops"},
];

const GlobalTab: React.FC = () => {
    const [numViews, setNumViews] = useState<number[]>([]);
    const [numUsers, setNumUsers] = useState<number[]>([]);
    const [lastAccess, setLastAccess] = useState<number[]>([]);
    const [activityLabels, setActivityLabels] = useState<string[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {

            const courseKey = Object.keys(result).find(key => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];

            const views: number[] = [];
            const users: number[] = [];
            const access: number[] = [];
            const labels: string[] = [];

            for (const {key, label} of activityTypes) {
                const activities = course[key] || [];
                const totalViews = activities.reduce((sum: number, a: any) => sum + (a.numViews || 0), 0);
                const totalUsers = activities.reduce((sum: number, a: any) => sum + (a.numUsers || 0), 0);
                const latestAccess = activities.reduce((latest: number, a: any) =>
                        a.lastAccess && a.lastAccess > latest ? a.lastAccess : latest,
                    0
                );

                views.push(totalViews);
                users.push(totalUsers);
                access.push(latestAccess || 0);
                labels.push(label);
            }

            setNumViews(views);
            setNumUsers(users);
            setLastAccess(access);
            setActivityLabels(labels);
        });
    }, []);

    const avgViewsPerUser = numViews.map((views, i) =>
        numUsers[i] !== 0 ? parseFloat((views / numUsers[i]).toFixed(2)) : 0
    );

    const daysSinceLastAccess = lastAccess.map(ts =>
        ts ? Math.floor(ts / (1000 * 60 * 60 * 24)) : 0
    );

    const totalViewsData = {
        labels: activityLabels,
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
        labels: activityLabels,
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
        labels: activityLabels,
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
                title="Total Visits by Activity Type"
                chartType="bar"
                data={totalViewsData}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>

            <GraphBlock
                title="Average Views per User"
                chartType="line"
                data={avgViewsData}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>

            <GraphBlock
                title="Days Since Last Access"
                chartType="radar"
                data={lastAccessData}
            />
        </div>
    );
};

export default GlobalTab;
