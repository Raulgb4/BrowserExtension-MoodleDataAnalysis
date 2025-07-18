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
import {
    extractUniqueRoles,
    filterByRoles,
    computeActiveInactive,
    computeAccessRanges,
} from "../../utils/chartDataUtils";
import {Participant} from "../../models/Participant";

const ParticipantsTab: React.FC = () => {
    const [activeCount, setActiveCount] = useState(0);
    const [inactiveCount, setInactiveCount] = useState(0);
    const [lastAccessRanges, setLastAccessRanges] = useState<number[]>([]);
    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [selectedRolesParticipation, setSelectedRolesParticipation] = useState<string[]>([]);
    const [selectedRolesAccess, setSelectedRolesAccess] = useState<string[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find(key => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const allParticipants = Array.isArray(course.participants) ? course.participants : [];
            const roleArray = extractUniqueRoles(allParticipants);

            setParticipants(allParticipants);
            setAvailableRoles(roleArray);
            setSelectedRolesParticipation(roleArray);
            setSelectedRolesAccess(roleArray);
        });
    }, []);

    useEffect(() => {
        const filtered = filterByRoles(participants, selectedRolesParticipation);
        const {active, inactive} = computeActiveInactive(filtered);
        setActiveCount(active);
        setInactiveCount(inactive);
    }, [participants, selectedRolesParticipation]);

    useEffect(() => {
        const filtered = filterByRoles(participants, selectedRolesAccess);
        const ranges = computeAccessRanges(filtered);
        setLastAccessRanges(ranges);
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

    const getFilteredTitle = (base: string, roles: string[]) => {
        if (roles.length === 0) return `${base} (No roles selected)`;
        if (roles.length === 1) return `${base} (${roles[0]})`;
        return `${base} (${roles.join(" & ")})`;
    };

    const RoleFilter: React.FC<{
        title: string;
        roles: string[];
        selectedRoles: string[];
        onToggle: (role: string) => void;
    }> = ({title, roles, selectedRoles, onToggle}) => (
        <>
            <p className="text-sm text-gray-700 mb-2 text-center font-medium w-full">
                {title}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
                {roles.map((role) => (
                    <label
                        key={role}
                        className="text-sm text-gray-700 cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            checked={selectedRoles.includes(role)}
                            onChange={() => onToggle(role)}
                            className="mr-1 rounded focus:ring focus:ring-orange-300 text-orange-500"
                        />
                        {role}
                    </label>
                ))}
            </div>
        </>
    );


    return (
        <div className="space-y-8">
            <GraphBlock
                title={getFilteredTitle("Global Participation", selectedRolesParticipation)}
                chartType="pie"
                data={pieData}
            >
                <RoleFilter
                    title="Filter by role:"
                    roles={availableRoles}
                    selectedRoles={selectedRolesParticipation}
                    onToggle={handleRoleChangeParticipation}
                />
            </GraphBlock>

            <hr className="border-t border-gray-300 w-3/4 mx-auto"/>

            <GraphBlock
                title={getFilteredTitle("Last Access Distribution", selectedRolesAccess)}
                chartType="line"
                data={accessData}
            >
                <RoleFilter
                    title="Filter by role:"
                    roles={availableRoles}
                    selectedRoles={selectedRolesAccess}
                    onToggle={handleRoleChangeAccess}
                />
            </GraphBlock>
        </div>
    );
};

export default ParticipantsTab;

