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
    createChartData,
} from "../../utils/chartDataUtils";
import "../../chartConfig";
import {ChartData} from "chart.js";

type ActivityTypeKey =
    | "choices"
    | "quizzes"
    | "forums"
    | "urlResources"
    | "resources"
    | "workshops";

// List of activity types to aggregate and visualize
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
    avgAccessAgeMs: number[];
    labels: string[];
}

// Aggregates view/user/access stats for each activity type
function aggregateActivityData(course: Record<string, any[]>): AggregatedData {
    const views: number[] = [];
    const users: number[] = [];
    const avgAccessAgeMs: number[] = [];
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

        const validAccesses = activities
            .map((a) => a.lastAccess)
            .filter((ts) => typeof ts === "number" && ts > 0);

        const avgDaysAgo =
            validAccesses.length > 0
                ? validAccesses.reduce((sum, ts) => sum + ts, 0) / validAccesses.length
                : 0;

        avgAccessAgeMs.push(avgDaysAgo);
        views.push(totalViews);
        users.push(totalUsers);
        labels.push(label);
    }

    return {views, users, avgAccessAgeMs, labels};
}

const GlobalTab: React.FC = () => {
    const [numViews, setNumViews] = useState<number[]>([]);
    const [numUsers, setNumUsers] = useState<number[]>([]);
    const [lastAccess, setLastAccess] = useState<number[]>([]);
    const [activityLabels, setActivityLabels] = useState<string[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            // Identify a course key stored in local storage
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            const course = result[courseKey];
            const {views, users, avgAccessAgeMs, labels} = aggregateActivityData(course);

            setNumViews(views);
            setNumUsers(users);
            setLastAccess(avgAccessAgeMs);
            setActivityLabels(labels);
        });
    }, []);

    // Derived metrics
    const avgViewsPerUser = calculateAvgViews(numViews, numUsers);
    const daysSinceLastAccess = lastAccess.map(ms => Math.floor(ms / (1000 * 60 * 60 * 24)));

    // Chart data for each metric
    const totalViewsData = createChartData(
        activityLabels,
        "Visits",
        numViews,
        {bg: "rgba(249, 128, 18, 0.6)", border: "rgba(249, 128, 18, 1)"}
    );

    const avgViewsData = createChartData(
        activityLabels,
        "Views",
        avgViewsPerUser,
        {bg: "rgba(100, 181, 246, 0.6)", border: "rgba(100, 181, 246, 1)"},
        {fill: false, tension: 0.3}
    );

    const generateColors = (count: number, opacity = 0.6): string[] => {
        const palette = [
            [255, 99, 132],
            [54, 162, 235],
            [255, 206, 86],
            [75, 192, 192],
            [153, 102, 255],
            [255, 159, 64],
            [100, 181, 246],
            [129, 199, 132],
            [233, 30, 99],
            [66, 165, 245],
        ];
        return Array.from({length: count}, (_, i) => {
            const [r, g, b] = palette[i % palette.length];
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        });
    };

    const polarColors = {
        bg: generateColors(activityLabels.length, 0.6),
        border: generateColors(activityLabels.length, 1),
    };

    const lastAccessData: ChartData<"polarArea"> = {
        labels: activityLabels,
        datasets: [
            {
                label: "Average Days",
                data: daysSinceLastAccess,
                backgroundColor: polarColors.bg,
                borderColor: polarColors.border,
                borderWidth: 1,
            },
        ],
    };

    // Array of chart configurations to render
    const chartBlocks = [
        {
            title: "Total Visits by Activity Typesssssssssssss",
            chartType: "bar" as const,
            data: totalViewsData,
        },
        {
            title: "Average Views per User",
            chartType: "line" as const,
            data: avgViewsData,
        },
        {
            title: "Average Days Since Last Access by Activity Type",
            chartType: "polarArea" as const,
            data: lastAccessData,
        }
    ];

    return (
        <>
            {chartBlocks.map(({title, chartType, data}, index) => (
                <React.Fragment key={title}>
                    <GraphBlock title={title} chartType={chartType} data={data}/>
                    {index < chartBlocks.length - 1 && (
                        <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                    )}
                </React.Fragment>
            ))}
        </>
    );
};

export default GlobalTab;
