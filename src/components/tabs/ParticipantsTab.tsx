/**
 * @file ParticipantsTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

const ParticipantsTab: React.FC = () => {
    // Datos ficticios de lastAccess en milisegundos desde último acceso
    const mockParticipants: { id: number; lastAccessToCourse?: number }[] = Array.from({ length: 215 }, (_, i) => {
        if (i < 120) return { id: i + 1, lastAccessToCourse: 1000 * 60 * 60 * 24 * Math.floor(Math.random() * 180) }; // hace X días
        if (i < 180) return { id: i + 1, lastAccessToCourse: 1000 * 60 * 60 * 24 * Math.floor(Math.random() * 7) }; // reciente
        return { id: i + 1 }; // sin acceso
    });

    const now = Date.now();
    const ranges = {
        "Last 7 days": 0,
        "8–30 days": 0,
        "31–90 days": 0,
        "> 90 days": 0,
        "Never accessed": 0,
    };

    for (const participant of mockParticipants) {
        const access = participant.lastAccessToCourse;
        if (access === undefined) {
            ranges["Never accessed"]++;
        } else {
            const daysAgo = Math.floor((now - access) / (1000 * 60 * 60 * 24));
            if (daysAgo <= 7) ranges["Last 7 days"]++;
            else if (daysAgo <= 30) ranges["8–30 days"]++;
            else if (daysAgo <= 90) ranges["31–90 days"]++;
            else ranges["> 90 days"]++;
        }
    }

    const labels = Object.keys(ranges);
    const values = Object.values(ranges);

    const data = {
        labels,
        datasets: [
            {
                label: "Participants by Last Access Time",
                data: values,
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
                title="Global Participation (Mock Data)"
                chartType="pie"
                data={{
                    labels: ["Active", "Inactive"],
                    datasets: [
                        {
                            label: "Participants",
                            data: [180, 35],
                            backgroundColor: [
                                "rgba(249, 128, 18, 0.6)",
                                "rgba(203, 213, 225, 0.8)",
                            ],
                            borderColor: "white",
                            borderWidth: 2,
                        },
                    ],
                }}
                labels={["Active", "Inactive"]}
                values={[180, 35]}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            <GraphBlock
                title="Last Access Distribution (Mock Data)"
                chartType="line"
                data={data}
                labels={labels}
                values={values}
            />
        </div>
    );
};

export default ParticipantsTab;
