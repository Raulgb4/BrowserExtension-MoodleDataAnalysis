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
import {
    calculateAvgViews,
    calculateDaysSince,
    createChartData,
} from "../../utils/chartDataUtils";
import "../../chartConfig";

type ActivityTypeKey =
    | "choices"
    | "quizzes"
    | "forums"
    | "urlResources"
    | "resources"
    | "workshops";

const activityTypes: { key: ActivityTypeKey; label: string }[] = [
    {key: "choices", label: "Choices"},
    {key: "quizzes", label: "Quizzes"},
    {key: "forums", label: "Forums"},
    {key: "urlResources", label: "URL Resources"},
    {key: "resources", label: "Resources"},
    {key: "workshops", label: "Workshops"},
];

interface AggregatedData {
    views: number[];
    users: number[];
    access: number[];
    labels: string[];
}

function aggregateActivityData(course: Record<string, any[]>): AggregatedData {
    const views: number[] = [];
    const users: number[] = [];
    const access: number[] = [];
    const labels: string[] = [];

    for (const {key, label} of activityTypes) {
        const activities = course[key] || [];

        const totalViews = activities.reduce(
            (sum, a) => sum + (a.numViews || 0),
            0
        );

        const totalUsers = activities.reduce(
            (sum, a) => sum + (a.numUsers || 0),
            0
        );

        const latestAccess = activities.reduce(
            (latest, a) =>
                a.lastAccess && a.lastAccess > latest ? a.lastAccess : latest,
            0
        );

        views.push(totalViews);
        users.push(totalUsers);
        access.push(latestAccess || 0);
        labels.push(label);
    }

    return {views, users, access, labels};
}

const GlobalTab: React.FC = () => {
    const [numViews, setNumViews] = useState<number[]>([]);
    const [numUsers, setNumUsers] = useState<number[]>([]);
    const [lastAccess, setLastAccess] = useState<number[]>([]);
    const [activityLabels, setActivityLabels] = useState<string[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            const course = result[courseKey];
            const {views, users, access, labels} = aggregateActivityData(course);

            setNumViews(views);
            setNumUsers(users);
            setLastAccess(access);
            setActivityLabels(labels);
        });
    }, []);

    const avgViewsPerUser = calculateAvgViews(numViews, numUsers);

    const daysSinceLastAccess = calculateDaysSince(lastAccess);

    const totalViewsData = createChartData(
        activityLabels,
        "Total Visits by Activity Type",
        numViews,
        {bg: "rgba(249, 128, 18, 0.6)", border: "rgba(249, 128, 18, 1)"}
    );

    const avgViewsData = createChartData(
        activityLabels,
        "Average Views per User",
        avgViewsPerUser,
        {bg: "rgba(100, 181, 246, 0.6)", border: "rgba(100, 181, 246, 1)"},
        {fill: false, tension: 0.3}
    );

    const lastAccessData = createChartData(
        activityLabels,
        "Days Since Last Access",
        daysSinceLastAccess,
        {bg: "rgba(255, 99, 132, 0.2)", border: "rgba(255, 99, 132, 1)"},
        {
            fill: true,
            pointBackgroundColor: "rgba(255, 99, 132, 1)",
        }
    );

    const chartBlocks = [
        {
            title: "Total Visits by Activity Type",
            chartType: "bar" as const,
            data: totalViewsData,
        },
        {
            title: "Average Views per User",
            chartType: "line" as const,
            data: avgViewsData,
        },
        {
            title: "Days Since Last Access",
            chartType: "radar" as const,
            data: lastAccessData,
        },
    ];

    return (
        <>
            {chartBlocks.map(({ title, chartType, data }, index) => (
                <React.Fragment key={title}>
                    <GraphBlock title={title} chartType={chartType} data={data} />
                    {index < chartBlocks.length - 1 && (
                        <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
                    )}
                </React.Fragment>
            ))}
        </>
    );
};

export default GlobalTab;
