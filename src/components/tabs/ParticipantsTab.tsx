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
    computeActiveInactive,
    DEFAULT_ACTIVE_THRESHOLD_DAYS,
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

    const [topForumId, setTopForumId] = useState<string | null>(null);
    const [topForumName, setTopForumName] = useState<string>("");
    const [topQuizId, setTopQuizId] = useState<string | null>(null);
    const [topQuizName, setTopQuizName] = useState<string>("");

    const [forumParticipation, setForumParticipation] = useState<Record<string, number>>({});
    const [quizGrades, setQuizGrades] = useState<Record<string, number>>({});

    const [xyPoints, setXyPoints] = useState<Array<{ pid: string; name: string; x: number; y: number }>>([]);

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

            const getMostViewed = (arr: any[] = []) => {
                if (arr.length === 0) return null;
                return arr
                    .slice()
                    .sort((a, b) => (b.numViews ?? 0) - (a.numViews ?? 0)
                        || String(a.id ?? "").localeCompare(String(b.id ?? "")))[0];
            };

            const topForum = getMostViewed(course.forums);
            const topQuiz = getMostViewed(course.quizzes);

            setTopForumId(topForum?.id ?? null);
            setTopForumName(topForum?.activityName ?? topForum?.title ?? "");
            setTopQuizId(topQuiz?.id ?? null);
            setTopQuizName(topQuiz?.activityName ?? topQuiz?.title ?? "");

            void chrome.storage.local.set({
                participants_top_forum_id: topForum?.id ?? null,
                participants_top_quiz_id: topQuiz?.id ?? null,
            });
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

    useEffect(() => {
        if (!topForumId) return;

        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const forum = (course.forums || []).find((f: any) => f.id === topForumId);
            if (!forum || !Array.isArray(forum.participantsStats)) return;

            const forumTotal = forum.participantsStats.reduce(
                (sum: number, p: any) => sum + p.discussionsPosted + p.repliesPosted + p.views,
                0
            );

            const participationMap: Record<string, number> = {};
            forum.participantsStats.forEach((p: any) => {
                const total = p.discussionsPosted + p.repliesPosted + p.views;
                participationMap[p.participantId] =
                    forumTotal > 0 ? parseFloat(((total / forumTotal) * 100).toFixed(2)) : 0;
            });

            setForumParticipation(participationMap);
        });
    }, [topForumId]);

    useEffect(() => {
        if (!topQuizId) return;

        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const quiz = (course.quizzes || []).find((q: any) => q.id === topQuizId);
            if (!quiz || !Array.isArray(quiz.participantStats)) return;

            const toNumber = (v: any) =>
                typeof v === "number" ? v :
                    typeof v === "string" ? parseFloat(v.replace(",", ".")) :
                        NaN;

            const gradesMap: Record<string, number> = {};

            quiz.participantStats.forEach((p: any) => {
                // 👉 usa directamente la nota sobre 10 que ya viene
                const g10 = toNumber(p.normalizedGrade);
                if (Number.isFinite(g10)) {
                    // opcional: clamp a [0,10]
                    const val = Math.max(0, Math.min(10, g10));
                    gradesMap[p.participantId] = +val.toFixed(2);
                }
            });

            setQuizGrades(gradesMap);
        });
    }, [topQuizId]);

    useEffect(() => {
        if (!topForumId || !topQuizId) {
            setXyPoints([]);
            return;
        }

        const pts: Array<{ pid: string; name: string; x: number; y: number }> = [];

        for (const p of participants) {
            const pid = String((p as any).participantId ?? (p as any).id);

            const x = forumParticipation[pid];
            const y = quizGrades[pid];

            if (typeof x === "number" && typeof y === "number") {
                pts.push({
                    pid,
                    name: (p as any).participantName ?? String(pid),
                    x: +x.toFixed(2),
                    y: +y.toFixed(2),
                });
            }
        }

        setXyPoints(pts);
    }, [participants, forumParticipation, quizGrades, topForumId, topQuizId]);


    function leastSquares(pts: { x: number; y: number }[]) {
        const n = pts.length;
        if (n < 2) return {a: 0, b: 0, r: 0, r2: 0};
        let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
        for (const p of pts) {
            sx += p.x;
            sy += p.y;
            sxy += p.x * p.y;
            sxx += p.x * p.x;
            syy += p.y * p.y;
        }
        const cov = sxy - (sx * sy) / n, varx = sxx - (sx * sx) / n, vary = syy - (sy * sy) / n;
        const b = varx === 0 ? 0 : cov / varx;
        const a = sy / n - b * (sx / n);
        const r = (varx === 0 || vary === 0) ? 0 : cov / Math.sqrt(varx * vary);
        return {a, b, r, r2: r * r};
    }

    t("legend.students");
    xyPoints.map(p => ({x: p.x, y: p.y}));
    t("chart.regression_line");
    t("axis.forum_participation_percent");
    t("axis.quiz_grade_0_10");

    const handleRoleChangeParticipation = (role: string) => {
        setSelectedRolesParticipation((prev) => {
            const updated = prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role];

            chrome.storage.local.set({
                filters_participants_roles_participation: updated,
            }).then(() => {
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
    }> = ({title, roles, selectedRoles, onToggle}) => (
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

    const xs = xyPoints.map(p => p.x);
    const maxX = xs.length ? Math.max(...xs) : 0;

    const pad = Math.max(0.5, maxX * 0.10);

    const rawUpper = Math.min(100, maxX + pad);
    const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

    const upperBound =
        rawUpper <= 10 ? roundUp(rawUpper, 1) :
            rawUpper <= 20 ? roundUp(rawUpper, 2) :
                rawUpper <= 50 ? roundUp(rawUpper, 5) :
                    roundUp(rawUpper, 10);

    const stepSize =
        upperBound <= 10 ? 1 :
            upperBound <= 20 ? 2 :
                upperBound <= 50 ? 5 : 10;

    const minXAxis = 0;
    const maxXAxis = upperBound;


    const {b, r, r2} = leastSquares(xyPoints);
    const rAbs = Math.abs(r);

    let strengthKey =
        rAbs < 0.10 ? "note.corr.none" :
            rAbs < 0.20 ? "note.corr.very_weak" :
                rAbs < 0.40 ? "note.corr.weak" :
                    rAbs < 0.60 ? "note.corr.moderate" :
                        rAbs < 0.80 ? "note.corr.strong" :
                            "note.corr.very_strong";

    const directionKey = r >= 0 ? "note.corr.positive" : "note.corr.negative";

    const corrText = t("note.corr.template", {
        strength: t(strengthKey, { defaultValue: "correlación prácticamente nula" }),
        direction: t(directionKey, { defaultValue: "positiva" }),
        defaultValue: "Correlación prácticamente nula (positiva)",
    });

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

            <hr className="border-t border-gray-300 w-3/4 mx-auto"/>

            {/* Scatter: forum participation (X) vs quiz grade (Y) */}
            {xyPoints.length >= 3 ? (
                <GraphBlock
                    title={t("chart.predictive.participation_vs_grade")}
                    chartType="scatter"
                    data={{
                        datasets: [
                            {
                                type: "scatter",
                                label: t("legend.students"),
                                data: xyPoints.map(p => ({
                                    x: p.x,
                                    y: p.y,
                                    studentName: p.name,
                                })),
                                pointRadius: 4,
                                pointBackgroundColor: "rgba(100, 181, 246, 0.6)",
                                pointBorderColor: "rgba(100, 181, 246, 1)",
                                pointHoverRadius: 6,
                                pointHoverBackgroundColor: "rgba(100, 181, 246, 1)",
                                pointHoverBorderColor: "rgba(100, 181, 246, 1)",
                            },
                            {
                                type: "line",
                                label: t("chart.regression_line"),
                                data: (() => {
                                    if (xyPoints.length < 2) return [];
                                    const {a, b} = leastSquares(xyPoints);
                                    return [
                                        {x: minXAxis, y: a + b * minXAxis},
                                        {x: maxXAxis, y: a + b * maxXAxis},
                                    ];
                                })(),
                                pointRadius: 0,
                                borderWidth: 2,
                                borderColor: "rgba(249, 128, 18, 1)",
                                backgroundColor: "rgba(249, 128, 18, 0.08)",
                                fill: false,
                                tension: 0,
                            },
                        ],
                    }}

                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                title: {display: true, text: t("axis.forum_participation_percent")},
                                min: minXAxis,
                                max: maxXAxis,
                                ticks: {
                                    stepSize,
                                    callback: (v) => `${v}%`,
                                },
                            },
                            y: {
                                title: {display: true, text: t("axis.quiz_grade_0_10")},
                                min: 0,
                                max: 10,
                            },
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: (items) => {
                                        const raw = (items?.[0]?.raw as any) || {};
                                        return raw.studentName ?? t("legend.students");
                                    },
                                    label: (ctx) => {
                                        const x = ctx.parsed.x?.toFixed?.(2) ?? ctx.parsed.x;
                                        const y = ctx.parsed.y?.toFixed?.(2) ?? ctx.parsed.y;
                                        return `${x}% · ${y}/10`;
                                    },
                                },
                            },
                        }
                    }}
                >
                    <ul className="mt-3 max-w-prose mx-auto list-disc list-inside text-[14px] sm:text-[15px] leading-relaxed text-gray-700 space-y-1">
                        <li>
                          <span>
                            {t("note.regression_summary", {
                                slope: b.toFixed(3),
                                r: r.toFixed(3),
                                r2: r2.toFixed(3),
                            })}
                          </span>
                            <span className="ml-2 text-gray-600">
                            {corrText}
                          </span>
                        </li>

                        <li className="text-[13px] sm:text-[14px] text-gray-600">
                            <span className="font-medium">
                              {t("label.forum")}:
                            </span>{" "}
                            <span>{topForumName || t("generic.unknown")}</span>
                        </li>

                        <li className="text-[13px] sm:text-[14px] text-gray-600">
                            <span className="font-medium">
                              {t("label.quiz")}:
                            </span>{" "}
                            <span>{topQuizName || t("generic.unknown")}</span>
                        </li>
                    </ul>
                </GraphBlock>
            ) : (
                <div
                    className="m-0 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md min-h-[300px] w-full flex items-center justify-center">
                    <p className="text-base text-orange-600 font-semibold">
                        {t("state.no_predictive_data")}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ParticipantsTab;