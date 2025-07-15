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

import React, { useEffect, useState } from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

const OtherActivitiesTab: React.FC = () => {
    const [urlResources, setUrlResources] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [workshops, setWorkshops] = useState<any[]>([]);
    const [topCount, setTopCount] = useState<number>(10);

    useEffect(() => {
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

    const getTopItems = (
        items: { activityName: string; numViews: number }[]
    ) => {
        return [...items]
            .sort((a, b) => b.numViews - a.numViews)
            .slice(0, topCount);
    };

    const getBarData = (
        items: { activityName: string; numViews: number }[],
        label: string,
        background: string,
        border: string
    ) => ({
        labels: items.map((i) => i.activityName),
        datasets: [
            {
                label,
                data: items.map((i) => i.numViews),
                backgroundColor: background,
                borderColor: border,
                borderWidth: 1,
            },
        ],
    });

    const renderGraphWithFilter = (
        title: string,
        items: any[],
        color: { bg: string; border: string }
    ) => {
        const topItems = getTopItems(items);
        return (
            <>
                <GraphBlock
                    title={`${title} (Top ${topCount})`}
                    chartType="bar"
                    data={getBarData(topItems, "Visits", color.bg, color.border)}
                    labels={topItems.map((i) => i.activityName)}
                    values={topItems.map((i) => i.numViews)}
                >
                    <div className="flex items-center justify-center gap-2 w-full text-sm text-gray-700">
                        <label>
                            Show top{" "}
                            <input
                                type="number"
                                value={topCount}
                                min={1}
                                max={100}
                                onChange={(e) =>
                                    setTopCount(Math.max(1, Number(e.target.value)))
                                }
                                className="border px-2 py-1 w-16 text-center rounded"
                            />{" "}
                            activities
                        </label>
                    </div>
                </GraphBlock>
                <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
            </>
        );
    };

    return (
        <div>
            {urlResources.length > 0 &&
                renderGraphWithFilter("URL Resource Visits", urlResources, {
                    bg: "rgba(100, 181, 246, 0.6)",
                    border: "rgba(100, 181, 246, 1)",
                })}

            {resources.length > 0 &&
                renderGraphWithFilter("File Resource Visits", resources, {
                    bg: "rgba(255, 167, 38, 0.6)",
                    border: "rgba(255, 167, 38, 1)",
                })}

            {workshops.length > 0 && (
                <GraphBlock
                    title="Workshop Visits"
                    chartType="bar"
                    data={getBarData(
                        getTopItems(workshops),
                        "Visits",
                        "rgba(129, 199, 132, 0.6)",
                        "rgba(129, 199, 132, 1)"
                    )}
                    labels={getTopItems(workshops).map((i) => i.activityName)}
                    values={getTopItems(workshops).map((i) => i.numViews)}
                >
                    <div className="flex items-center justify-center gap-2 w-full text-sm text-gray-700">
                        <label>
                            Show top{" "}
                            <input
                                type="number"
                                value={topCount}
                                min={1}
                                max={100}
                                onChange={(e) =>
                                    setTopCount(Math.max(1, Number(e.target.value)))
                                }
                                className="border px-2 py-1 w-16 text-center rounded"
                            />{" "}
                            activities
                        </label>
                    </div>
                </GraphBlock>
            )}
        </div>
    );
};

export default OtherActivitiesTab;
