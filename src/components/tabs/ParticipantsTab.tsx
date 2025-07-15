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
    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [selectedRolesParticipation, setSelectedRolesParticipation] = useState<string[]>([]);
    const [selectedRolesAccess, setSelectedRolesAccess] = useState<string[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find(key => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const allParticipants = course.participants || [];

            const allRoles = new Set<string>();
            for (const p of allParticipants) {
                if (Array.isArray(p.roles)) {
                    p.roles.forEach((r: string) => allRoles.add(r));
                }
            }

            const roleArray = Array.from(allRoles);
            setParticipants(allParticipants);
            setAvailableRoles(roleArray);
            setSelectedRolesParticipation(roleArray);
            setSelectedRolesAccess(roleArray);
        });
    }, []);

    useEffect(() => {
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        let active = 0;
        let inactive = 0;

        const filtered = participants.filter((p) =>
            p.roles?.some((r: string) => selectedRolesParticipation.includes(r))
        );

        for (const p of filtered) {
            const lastAccess = p.lastAccessToCourse;
            const daysAgo = lastAccess !== undefined ? Math.floor(lastAccess / MS_PER_DAY) : null;

            if (daysAgo === null || daysAgo > 7) inactive++;
            else active++;
        }

        setActiveCount(active);
        setInactiveCount(inactive);
    }, [participants, selectedRolesParticipation]);

    useEffect(() => {
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        const ranges = {
            "Last 7 days": 0,
            "8-30 days": 0,
            "31-90 days": 0,
            "> 90 days": 0,
            "Never accessed": 0,
        };

        const filtered = participants.filter((p) =>
            p.roles?.some((r: string) => selectedRolesAccess.includes(r))
        );

        for (const p of filtered) {
            const lastAccess = p.lastAccessToCourse;

            if (lastAccess === undefined) {
                ranges["Never accessed"]++;
            } else {
                const daysAgo = Math.floor(lastAccess / MS_PER_DAY);

                if (daysAgo <= 7) ranges["Last 7 days"]++;
                else if (daysAgo <= 30) ranges["8-30 days"]++;
                else if (daysAgo <= 90) ranges["31-90 days"]++;
                else ranges["> 90 days"]++;
            }
        }

        setLastAccessRanges(Object.values(ranges));
    }, [participants, selectedRolesAccess]);

    const handleRoleChangeParticipation = (role: string) => {
        setSelectedRolesParticipation(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const handleRoleChangeAccess = (role: string) => {
        setSelectedRolesAccess(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

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
        <div className="space-y-8">
            {/* Gráfica 1 con filtros */}
            <GraphBlock
                title="Global Participation"
                chartType="pie"
                data={pieData}
                labels={["Active", "Inactive"]}
                values={[activeCount, inactiveCount]}
            >
                <p className="text-sm text-gray-700 mb-2 text-center font-medium w-full">
                    Filter by role:
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    {availableRoles.map((role) => (
                        <label key={role} className="text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={selectedRolesParticipation.includes(role)}
                                onChange={() => handleRoleChangeParticipation(role)}
                                className="mr-1"
                            />
                            {role}
                        </label>
                    ))}
                </div>
            </GraphBlock>

            <hr className="border-t border-gray-300 w-3/4 mx-auto"/>

            {/* Gráfica 2 con filtros */}
            <GraphBlock
                title="Last Access Distribution"
                chartType="line"
                data={accessData}
                labels={lastAccessLabels}
                values={lastAccessRanges}
            >
                <p className="text-sm text-gray-700 mb-2 text-center font-medium w-full">
                    Filter by role:
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    {availableRoles.map((role) => (
                        <label key={role} className="text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={selectedRolesAccess.includes(role)}
                                onChange={() => handleRoleChangeAccess(role)}
                                className="mr-1"
                            />
                            {role}
                        </label>
                    ))}
                </div>
            </GraphBlock>
        </div>
    );
};

export default ParticipantsTab;

