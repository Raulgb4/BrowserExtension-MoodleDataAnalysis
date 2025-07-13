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

    return (
        <div>
            {/* URL Resources */}
            {urlResources.length > 0 && (
                <>
                    <GraphBlock
                        title="URL Resource Visits"
                        chartType="bar"
                        data={getBarData(
                            urlResources,
                            "Visits",
                            "rgba(100, 181, 246, 0.6)",
                            "rgba(100, 181, 246, 1)"
                        )}
                        labels={urlResources.map((i) => i.activityName)}
                        values={urlResources.map((i) => i.numViews)}
                    />
                    <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
                </>
            )}

            {/* File Resources */}
            {resources.length > 0 && (
                <>
                    <GraphBlock
                        title="File Resource Visits"
                        chartType="bar"
                        data={getBarData(
                            resources,
                            "Visits",
                            "rgba(255, 167, 38, 0.6)",
                            "rgba(255, 167, 38, 1)"
                        )}
                        labels={resources.map((i) => i.activityName)}
                        values={resources.map((i) => i.numViews)}
                    />
                    <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
                </>
            )}

            {/* Workshops */}
            {workshops.length > 0 && (
                <GraphBlock
                    title="Workshop Visits"
                    chartType="bar"
                    data={getBarData(
                        workshops,
                        "Visits",
                        "rgba(129, 199, 132, 0.6)",
                        "rgba(129, 199, 132, 1)"
                    )}
                    labels={workshops.map((i) => i.activityName)}
                    values={workshops.map((i) => i.numViews)}
                />
            )}
        </div>
    );
};

export default OtherActivitiesTab;
