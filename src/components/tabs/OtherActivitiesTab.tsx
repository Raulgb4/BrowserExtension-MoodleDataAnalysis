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
import {useTranslation} from "react-i18next";

type GraphKey = "url" | "file" | "workshop";

interface GraphConfig {
    key: GraphKey;
    titleKey: string;
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
        url: 3,
        file: 3,
        workshop: 3,
    });

    const {t} = useTranslation();

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

            const savedCounts = result["filters_other_activities_top_counts"];
            if (
                savedCounts &&
                typeof savedCounts === "object" &&
                ["url", "file", "workshop"].every((key) =>
                    typeof savedCounts[key] === "number"
                )
            ) {
                setTopCounts(savedCounts);
            }
        });
    }, []);

    // Render chart and input control for one activity type
    const renderGraphWithFilter = (
        key: GraphKey,
        titleKey: string,
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
                    label: t("legend.visits"),
                    data: values,
                    backgroundColor: color.bg,
                    borderColor: color.border,
                    borderWidth: 1,
                },
            ],
        };

        const handleChange = (value: number) => {
            const sanitizedValue = Math.max(1, value); // Enforce minimum of 1

            setTopCounts((prev) => {
                const updated = {
                    ...prev,
                    [key]: sanitizedValue,
                };

                chrome.storage.local.set({
                    filters_other_activities_top_counts: updated
                }).then(() => {
                    console.log("Saved top counts for other activities (immediate).");
                });

                return updated;
            });
        };

        return (
            <div key={key}>
                <GraphBlock
                    title={t("chart.other_top_n", {name: t(titleKey), count})}
                    chartType="bar"
                    data={chartData}
                >
                    {/* Input for adjusting top N value */}
                    <div className="flex items-center justify-center gap-2 w-full text-sm text-gray-700">
                        <label htmlFor={`top-input-${key}`} className="flex items-center gap-2">
                            {t("filter.show_top")}
                            <input
                                id={`top-input-${key}`}
                                type="number"
                                min={1}
                                max={items.length}
                                value={count}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    const maxAllowed = items.length;
                                    const sanitizedValue = Number.isNaN(value)
                                        ? 1
                                        : Math.min(Math.max(1, value), maxAllowed);
                                    handleChange(sanitizedValue);
                                }}
                                className="border px-2 py-1 w-16 text-center rounded"
                            />
                            {t("label.activities")}
                        </label>
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
            titleKey: "chart.url_visits",
            items: urlResources,
            color: {
                bg: "rgba(100, 181, 246, 0.6)",
                border: "rgba(100, 181, 246, 1)",
            },
        },
        {
            key: "file" as const,
            titleKey: "chart.file_visits",
            items: resources,
            color: {
                bg: "rgba(255, 167, 38, 0.6)",
                border: "rgba(255, 167, 38, 1)",
            },
        },
        {
            key: "workshop" as const,
            titleKey: "chart.workshop_visits",
            items: workshops,
            color: {
                bg: "rgba(129, 199, 132, 0.6)",
                border: "rgba(129, 199, 132, 1)",
            },
        },
    ].filter((g) => g.items.length > 0);


    return (
        <div>
            {graphsToRender.length === 0 && (
                <>
                    <GraphBlock
                        title={t("chart.activity_overview")}
                        chartType="bar"
                        data={{
                            labels: [],
                            datasets: [
                                {
                                    label: t("chart.top_activities"),
                                    data: [],
                                    backgroundColor: "rgba(203, 213, 225, 0.6)",
                                    borderColor: "rgba(203, 213, 225, 1)",
                                    borderWidth: 1,
                                },
                            ],
                        }}
                    />
                    <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                </>
            )}

            {/* Render real data */}
            {graphsToRender.map((g, index) =>
                renderGraphWithFilter(
                    g.key,
                    g.titleKey,
                    g.items,
                    g.color,
                    index < graphsToRender.length - 1
                )
            )}
        </div>
    );
};

export default OtherActivitiesTab;
