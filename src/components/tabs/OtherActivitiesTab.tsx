/**
 * @file OtherActivitiesTab.tsx
 *
 * @description
 * Displays bar charts for additional Moodle activities: URL resources, files, and workshops.
 * Use the reusable GraphBlock component for consistent layout and export functionality.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, {useEffect, useState} from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";
import {ActivityBase, Resource, URLResource, Workshop} from "../../models/ActivityBase";
import {ChartData} from "chart.js";
import {getTopByMetric} from "../../utils/chartDataUtils";

type GraphKey = "url" | "file" | "workshop";

interface GraphConfig {
    key: GraphKey;
    title: string;
    items: ActivityBase[];
    color: {
        bg: string;
        border: string;
    };
}

const OtherActivitiesTab: React.FC = () => {
    const [urlResources, setUrlResources] = useState<URLResource[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [workshops, setWorkshops] = useState<Workshop[]>([]);

    // Stores the number of top items to show per activity type
    const [topCounts, setTopCounts] = useState<Record<GraphKey, number>>({
        url: 10,
        file: 10,
        workshop: 10,
    });

    useEffect(() => {
        // Load activity data from local storage
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            const course = result[courseKey];
            setUrlResources(course.urlResources || []);
            setResources(course.resources || []);
            setWorkshops(course.workshops || []);
        });
    }, []);

    // Render chart and input control for one activity type
    const renderGraphWithFilter = (
        key: GraphKey,
        title: string,
        items: ActivityBase[],
        color: { bg: string; border: string },
        showDivider: boolean
    ) => {
        const count = topCounts[key];

        // Get top N items by number of views
        const {labels, values} = getTopByMetric(
            items,
            count,
            (item) => item.numViews,
            (item) => item.activityName
        );

        const chartData: ChartData<"bar"> = {
            labels,
            datasets: [
                {
                    label: "Visits",
                    data: values,
                    backgroundColor: color.bg,
                    borderColor: color.border,
                    borderWidth: 1,
                },
            ],
        };

        const handleChange = (value: number) => {
            setTopCounts((prev) => ({
                ...prev,
                [key]: Math.max(1, value), // Enforce a minimum of 1
            }));
        };

        return (
            <div key={key}>
                <GraphBlock
                    title={`${title} - Top ${count} activities`}
                    chartType="bar"
                    data={chartData}
                >
                    {/* Input for adjusting top N value */}
                    <div className="flex items-center justify-center gap-2 w-full text-sm text-gray-700">
                        <label htmlFor={`top-input-${key}`}>Show top</label>
                        <input
                            id={`top-input-${key}`}
                            type="number"
                            value={count}
                            min={1}
                            max={100}
                            onChange={(e) => handleChange(Number(e.target.value))}
                            className="border px-2 py-1 w-16 text-center rounded"
                        />
                        <span>activities</span>
                    </div>
                </GraphBlock>

                {/* Divider between charts */}
                {showDivider && (
                    <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                )}
            </div>
        );
    };

    // Define which activity groups to display charts for
    const graphsToRender: GraphConfig[] = [
        {
            key: "url" as const,
            title: "URL Resource Visits",
            items: urlResources,
            color: {
                bg: "rgba(100, 181, 246, 0.6)",
                border: "rgba(100, 181, 246, 1)",
            },
        },
        {
            key: "file" as const,
            title: "File Resource Visits",
            items: resources,
            color: {
                bg: "rgba(255, 167, 38, 0.6)",
                border: "rgba(255, 167, 38, 1)",
            },
        },
        {
            key: "workshop" as const,
            title: "Workshop Visits",
            items: workshops,
            color: {
                bg: "rgba(129, 199, 132, 0.6)",
                border: "rgba(129, 199, 132, 1)",
            },
        },
    ].filter((g) => g.items.length > 0); // Only render non-empty groups

    return (
        <div>
            {/* Render charts for all configured activity groups */}
            {graphsToRender.map((g, index) =>
                renderGraphWithFilter(
                    g.key,
                    g.title,
                    g.items,
                    g.color,
                    index < graphsToRender.length - 1
                )
            )}
        </div>
    );
};

export default OtherActivitiesTab;
