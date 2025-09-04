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
    computeAccessRanges,
    computeActiveInactive, DEFAULT_ACTIVE_THRESHOLD_DAYS,
    extractUniqueRoles,
    filterByRoles,
} from "../../utils/chartDataUtils";
import {Participant} from "../../models/Participant";
import {useTranslation} from "react-i18next";
import {TFunction} from "i18next";

const ParticipantsTab: React.FC = () => {
    // State for active/inactive participant counts
    const [activeCount, setActiveCount] = useState(0);
    const [inactiveCount, setInactiveCount] = useState(0);

    // State for access time range counts
    const [lastAccessRanges, setLastAccessRanges] = useState<number[]>([]);

    // Roles available and currently selected for filtering
    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [selectedRolesParticipation, setSelectedRolesParticipation] = useState<string[]>([]);
    const [selectedRolesAccess, setSelectedRolesAccess] = useState<string[]>([]);

    const [participants, setParticipants] = useState<Participant[]>([]);

    const {t} = useTranslation();

    const ACTIVE_THRESHOLD_DAYS = DEFAULT_ACTIVE_THRESHOLD_DAYS;

    useEffect(() => {
        // Load participants and roles from local storage
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find(key => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const allParticipants = Array.isArray(course.participants) ? course.participants : [];
            const roleArray = extractUniqueRoles(allParticipants);

            setParticipants(allParticipants);
            setAvailableRoles(roleArray);

            const storedParticipation = result.filters_participants_roles_participation;
            const storedAccess = result.filters_participants_roles_access;

            setSelectedRolesParticipation(
                Array.isArray(storedParticipation) ? storedParticipation : roleArray
            );
            setSelectedRolesAccess(
                Array.isArray(storedAccess) ? storedAccess : roleArray
            );
        });
    }, []);

    useEffect(() => {
        // Update active/inactive count based on selected roles
        const filtered = filterByRoles(participants, selectedRolesParticipation);
        const {active, inactive} = computeActiveInactive(filtered, ACTIVE_THRESHOLD_DAYS);
        setActiveCount(active);
        setInactiveCount(inactive);
    }, [participants, selectedRolesParticipation]);

    useEffect(() => {
        // Update the last access range distribution based on selected roles
        const filtered = filterByRoles(participants, selectedRolesAccess);
        const ranges = computeAccessRanges(filtered);
        setLastAccessRanges(ranges);
    }, [participants, selectedRolesAccess]);

    const handleRoleChangeParticipation = (role: string) => {
        setSelectedRolesParticipation((prev) => {
            const updated = prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role];

            chrome.storage.local.set({
                filters_participants_roles_participation: updated,
            }).then(() => {
                console.log("Saved participation filters immediately.");
            });

            return updated;
        });
    };


    const handleRoleChangeAccess = (role: string) => {
        setSelectedRolesAccess((prev) => {
            const updated = prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role];

            chrome.storage.local.set({
                filters_participants_roles_access: updated,
            }).then(() => {
                console.log("Saved access filters immediately.");
            });

            return updated;
        });
    };


    const pieData = {
        labels: [t("legend.active"), t("legend.inactive")],
        datasets: [
            {
                label: t("legend.participants"),
                data: [activeCount, inactiveCount],
                backgroundColor: [
                    "rgba(249, 128, 18, 0.6)", // orange
                    "rgba(203, 213, 225, 0.8)", // gray
                ],
                borderColor: "white",
                borderWidth: 2,
            },
        ],
    };

    const lastAccessLabels = [
        t("access.last_7_days"),
        t("access.days_8_30"),
        t("access.days_31_90"),
        t("access.more_than_90"),
        t("access.never_accessed"),
    ];

    const accessData = {
        labels: lastAccessLabels,
        datasets: [
            {
                label: t("legend.participants"),
                data: lastAccessRanges,
                fill: true,
                borderColor: "rgba(59, 130, 246, 1)", // blue
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                pointBackgroundColor: "rgba(59, 130, 246, 1)",
                tension: 0.3, // line smoothing
            },
        ],
    };

    const getFilteredTitle = (base: string, roles: string[], t: TFunction) => {
        if (roles.length === 0) return `${base} (${t("roles.none_selected")})`;
        if (roles.length === 1) return `${base} (${roles[0]})`;
        return `${base} (${roles.join(" & ")})`;
    };

    // Role selector component for chart filters
    const RoleFilter: React.FC<{
        title: string;
        roles: string[];
        selectedRoles: string[];
        onToggle: (role: string) => void;
    }> = ({ title, roles, selectedRoles, onToggle }) => (
        <>
            <p className="text-sm text-gray-700 mb-2 text-center font-medium w-full">
                {title}
            </p>

            <div className="w-full flex flex-wrap justify-center gap-4 mx-auto">
                {roles.map((role) => (
                    <label key={role} className="text-sm text-gray-700 cursor-pointer">
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
            {/* Pie chart: Active vs Inactive participants */}
            <GraphBlock
                title={getFilteredTitle(t("chart.global_participation"), selectedRolesParticipation, t)}
                chartType="pie"
                data={pieData}
            >
                <RoleFilter
                    title={t("filter.by_role")}
                    roles={availableRoles}
                    selectedRoles={selectedRolesParticipation}
                    onToggle={handleRoleChangeParticipation}
                />
                <p
                    role="note"
                    className="mt-2 text-center text-xs sm:text-sm text-gray-600 leading-snug max-w-prose mx-auto px-4 break-words"
                >
                    <span className="font-medium">{t("legend.active")}:</span>{" "}
                    {t("note.active_participant_definition", {days: ACTIVE_THRESHOLD_DAYS})}
                </p>
            </GraphBlock>

            <hr className="border-t border-gray-300 w-3/4 mx-auto"/>

            {/* Line chart: Last access distribution */}
            <GraphBlock
                title={getFilteredTitle(t("chart.last_access_distribution"), selectedRolesAccess, t)}

                chartType="line"
                data={accessData}
            >
                <RoleFilter
                    title={t("filter.by_role")}
                    roles={availableRoles}
                    selectedRoles={selectedRolesAccess}
                    onToggle={handleRoleChangeAccess}
                />
            </GraphBlock>
        </div>
    );
};

export default ParticipantsTab;