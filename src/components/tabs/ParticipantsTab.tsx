/**
 * @file ParticipantsTab.tsx
 *
 * @description
 * Displays participant engagement statistics using real data stored in Chrome local storage.
 * Classifies participants as active or inactive based on the time since their last access.
 * Visualizes:
 * - Distribution of last access times (grouped into ranges)
 * - Proportion of active vs. inactive participants
 * Data is dynamically computed and rendered through pie and line charts.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, {useEffect, useState} from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

const ParticipantsTab: React.FC = () => {
    const [activeCount, setActiveCount] = useState(0);
    const [inactiveCount, setInactiveCount] = useState(0);
    const [lastAccessRanges, setLastAccessRanges] = useState<number[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find(key => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const participants = course.participants || [];

            const MS_PER_DAY = 1000 * 60 * 60 * 24;
            const ranges = {
                "Last 7 days": 0,
                "8-30 days": 0,
                "31-90 days": 0,
                "> 90 days": 0,
                "Never accessed": 0,
            };

            let active = 0;
            let inactive = 0;

            for (const p of participants) {
                const lastAccess = p.lastAccessToCourse;

                if (lastAccess === undefined) {
                    ranges["Never accessed"]++;
                    inactive++;
                } else {
                    const daysAgo = Math.floor(lastAccess / MS_PER_DAY);

                    // Rango de días
                    if (daysAgo <= 7) ranges["Last 7 days"]++;
                    else if (daysAgo <= 30) ranges["8-30 days"]++;
                    else if (daysAgo <= 90) ranges["31-90 days"]++;
                    else ranges["> 90 days"]++;

                    // Criterio de actividad
                    if (daysAgo <= 7) active++;
                    else inactive++;
                }
            }

            setActiveCount(active);
            setInactiveCount(inactive);
            setLastAccessRanges(Object.values(ranges));
        });
    }, []);

    const pieData = {
        labels: ["Active", "Inactive"],
        datasets: [
            {
                label: "Participants",
                data: [activeCount, inactiveCount],
                backgroundColor: [
                    "rgba(249, 128, 18, 0.6)",
                    "rgba(203, 213, 225, 0.8)",
                ],
                borderColor: "white",
                borderWidth: 2,
            },
        ],
    };

    const lastAccessLabels = [
        "Last 7 days",
        "8-30 days",
        "31-90 days",
        "> 90 days",
        "Never accessed",
    ];

    const accessData = {
        labels: lastAccessLabels,
        datasets: [
            {
                label: "Participants by Last Access Time",
                data: lastAccessRanges,
                fill: true,
                borderColor: "rgba(59, 130, 246, 1)",
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                pointBackgroundColor: "rgba(59, 130, 246, 1)",
                tension: 0.3,
            },
        ],
    };

    return (
        <div>
            <GraphBlock
                title="Global Participation"
                chartType="pie"
                data={pieData}
                labels={["Active", "Inactive"]}
                values={[activeCount, inactiveCount]}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>

            <GraphBlock
                title="Last Access Distribution"
                chartType="line"
                data={accessData}
                labels={lastAccessLabels}
                values={lastAccessRanges}
            />
        </div>
    );
};

export default ParticipantsTab;
