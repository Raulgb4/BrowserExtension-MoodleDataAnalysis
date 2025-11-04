/**
 * @file CorrelationsTab.tsx
 *
 * @description
 * This component displays statistical correlation graphs between different student activity metrics
 * (predictors) and their corresponding grades in various evaluated activities (targets).
 * It follows the same visualization style as other analytical tabs, using GraphBlock components
 * and localized titles via the i18n system.
 *
 * Future extensions may include automatic CSV export of the numerical datasets and
 * dynamic rendering of multiple correlation combinations based on available course data.
 *
 * @author Raúl García Balongo
 * @date 2025
 */


import React, {useEffect, useMemo, useState} from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";
import {useTranslation} from "react-i18next";
import {Participant} from "../../models/Participant";
import {buildForumParticipationPct, buildQuizAvgGradeMap} from "../../utils/dataAggregation";
import {
    buildCorrelationPoints,
    classifyCorrelation,
    computeXAxisBounds,
    leastSquares,
    regressionY
} from "../../utils/correlationMath";


const CorrelationsTab: React.FC = () => {
    const {t} = useTranslation();

    // Raw data loaded async (keep in state)
    const [forumParticipationPct, setForumParticipationPct] = useState<Record<string, number>>({});
    const [quizAvgGrade, setQuizAvgGrade] = useState<Record<string, number>>({});
    const [participants, setParticipants] = useState<Participant[]>([]);

    // Derive once, reuse everywhere --------------------------------------------
    // Map for quick lookups by participant id (pid)
    //   "123" => { id: "123", participantName: "Ana Pérez", role: "student" },
    const participantsById = useMemo(() => {
        const m = new Map<string, Participant>();
        for (const p of participants) m.set(String(p.id), p);
        return m;
    }, [participants]);

    // Build XY points on the fly (don’t store derived arrays in state)
    const xyPoints = useMemo(
        () => buildCorrelationPoints(forumParticipationPct, quizAvgGrade, participantsById),
        [forumParticipationPct, quizAvgGrade, participantsById]
    );

    // NOTE: we deliberately do NOT store `name` inside xyPoints:
    // it avoids duplication; resolve names from `participantsById` where needed.


    useEffect(() => {
        // Small helper to keep the effect body minimal
        const loadCourseData = async () => {
            chrome.storage.local.get(null, (result) => {
                // Find the first key that starts with "course_"
                const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
                if (!courseKey) return;

                const course = result[courseKey] ?? {};
                const allParticipants = Array.isArray(course.participants) ? course.participants : [];

                // Load participants only (availableRoles derived later via useMemo)
                setParticipants(allParticipants);

                // Initialize default scopes (not critical but keeps consistency)
                void chrome.storage.local.set({
                    participants_scope_forums: "all",
                    participants_scope_quizzes: "all",
                });
            });
        };

        void loadCourseData();
    }, []);


    useEffect(() => {
        // Load forum participation from local storage and normalize to %
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey] ?? {};
            const forums = Array.isArray(course?.forums) ? course.forums : [];

            // Delegate aggregation to a reusable helper
            const pctMap = buildForumParticipationPct(forums);
            setForumParticipationPct(pctMap);
        });
    }, []);


    useEffect(() => {
        // Load average quiz grades from local storage
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey] ?? {};
            const quizzes = Array.isArray(course?.quizzes) ? course.quizzes : [];

            const avgGradesMap = buildQuizAvgGradeMap(quizzes);
            setQuizAvgGrade(avgGradesMap);
        });
    }, []);


    // Axis: compute a "nice" 0..100% X scale based on current points.
    const {min: minXAxis, max: maxXAxis, stepSize} = useMemo(() => {
        // keeps labels tidy as data scales
        return computeXAxisBounds(xyPoints, 100);
    }, [xyPoints]);

    // Regression and correlation stats for current points
    const {a, b, r, r2} = useMemo(() => leastSquares(xyPoints), [xyPoints]);

    // Human-friendly labels (i18n) describing correlation strength and direction
    const {strengthKey, directionKey} = useMemo(() => classifyCorrelation(r), [r]);

    // Final note shown in UI (e.g., legend or caption)
    const corrText = useMemo(() => {
        // Keep it pure and derived; default values can live in your i18n JSON
        return t("note.corr.template", {
            strength: t(strengthKey),
            direction: t(directionKey),
        });
    }, [t, strengthKey, directionKey]);


    return (
        <div className="space-y-8">
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
                                data: xyPoints.map((p) => ({
                                    x: p.x,
                                    y: p.y,
                                    studentName: participantsById.get(p.pid)?.participantName ?? String(p.pid),
                                })),
                                pointRadius: 4,
                                pointBackgroundColor: "rgba(100,181,246,0.6)",
                                pointBorderColor: "rgba(100,181,246,1)",
                                pointHoverRadius: 6,
                                pointHoverBackgroundColor: "rgba(100,181,246,1)",
                                pointHoverBorderColor: "rgba(100,181,246,1)",
                            },
                            {
                                type: "line",
                                label: t("chart.regression_line"),
                                data: [
                                    {x: minXAxis, y: regressionY(a, b, minXAxis)},
                                    {x: maxXAxis, y: regressionY(a, b, maxXAxis)},
                                ],
                                pointRadius: 0,
                                borderWidth: 2,
                                borderColor: "rgba(249,128,18,1)",
                                backgroundColor: "rgba(249,128,18,0.08)",
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
                                        const raw = items?.[0]?.raw as any;
                                        return raw.studentName ?? t("legend.students");
                                    },
                                    label: (ctx) => {
                                        const x = ctx.parsed.x?.toFixed?.(2) ?? ctx.parsed.x;
                                        const y = ctx.parsed.y?.toFixed?.(2) ?? ctx.parsed.y;
                                        return `${x}% · ${y}/10`;
                                    },
                                },
                            },
                        },
                    }}
                >
                    {/* Correlation summary below the graph */}
                    <ul className="mt-3 max-w-prose mx-auto list-disc list-inside text-sm sm:text-[15px] leading-relaxed text-gray-700 space-y-1">
                        <li>
                            <span className="font-semibold">{t("note.slope_title")}: </span>
                            {t("note.slope_explainer", {slope: b.toFixed(3)})}
                        </li>
                        <li>
                            <span className="font-semibold">{t("note.r_title")}: </span>
                            {t("note.r_explainer", {
                                r: r.toFixed(3),
                                corr: corrText, // e.g., "moderate positive correlation"
                            })}
                        </li>
                        <li>
                            <span className="font-semibold">{t("note.r2_title")}: </span>
                            {t("note.r2_explainer", {pct: (r2 * 100).toFixed(1)})}
                        </li>
                    </ul>
                </GraphBlock>
            ) : (
                // Empty-state fallback
                <div
                    className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md min-h-[300px] flex items-center justify-center">
                    <p className="text-base text-orange-600 font-semibold">
                        {t("state.no_predictive_data")}
                    </p>
                </div>
            )}
        </div>
    );
};

export default CorrelationsTab;
