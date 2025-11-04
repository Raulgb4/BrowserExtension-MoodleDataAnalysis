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


import React, {useEffect, useState} from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";
import {useTranslation} from "react-i18next";
import {extractUniqueRoles} from "../../utils/chartDataUtils";
import {Participant} from "../../models/Participant";


const CorrelationsTab: React.FC = () => {
    const {t} = useTranslation();

    const [forumParticipation, setForumParticipation] = useState<Record<string, number>>({});
    const [quizGrades, setQuizGrades] = useState<Record<string, number>>({});

    const [xyPoints, setXyPoints] = useState<Array<{ pid: string; name: string; x: number; y: number }>>([]);

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [selectedRolesParticipation, setSelectedRolesParticipation] = useState<string[]>([]);
    const [selectedRolesAccess, setSelectedRolesAccess] = useState<string[]>([]);


    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey] ?? {};
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

            void chrome.storage.local.set({
                participants_scope_forums: "all",
                participants_scope_quizzes: "all",
            });
        });
    }, []);


    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const forums: any[] = Array.isArray(course?.forums) ? course.forums : [];

            const perPidTotals: Record<string, number> = {};
            let grandTotal = 0;

            for (const f of forums) {
                const stats: any[] = Array.isArray(f?.participantsStats) ? f.participantsStats : [];
                for (const s of stats) {
                    const pid = String(s.participantId);
                    const total = (s.discussionsPosted ?? 0) + (s.repliesPosted ?? 0) + (s.views ?? 0);
                    perPidTotals[pid] = (perPidTotals[pid] ?? 0) + total;
                    grandTotal += total;
                }
            }

            const participationMap: Record<string, number> = {};
            for (const pid of Object.keys(perPidTotals)) {
                participationMap[pid] =
                    grandTotal > 0 ? +(((perPidTotals[pid] / grandTotal) * 100).toFixed(2)) : 0;
            }

            setForumParticipation(participationMap);
        });
    }, []);


    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const quizzes: any[] = Array.isArray(course?.quizzes) ? course.quizzes : [];

            const toNumber = (v: any) =>
                typeof v === "number" ? v :
                    typeof v === "string" ? parseFloat(v.replace(",", ".")) :
                        NaN;

            const perPidGrades: Record<string, number[]> = {};
            for (const q of quizzes) {
                const stats: any[] = Array.isArray(q?.participantStats) ? q.participantStats : [];
                for (const s of stats) {
                    const pid = String(s.participantId);
                    const g10 = toNumber(s.normalizedGrade);
                    if (Number.isFinite(g10)) {
                        const clamped = Math.max(0, Math.min(10, g10));
                        (perPidGrades[pid] ??= []).push(clamped);
                    }
                }
            }

            const gradesMap: Record<string, number> = {};
            for (const pid of Object.keys(perPidGrades)) {
                const arr = perPidGrades[pid];
                const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
                gradesMap[pid] = +avg.toFixed(2);
            }

            setQuizGrades(gradesMap);
        });
    }, []);


    useEffect(() => {
        const pts: Array<{ pid: string; name: string; x: number; y: number }> = [];

        for (const p of participants) {
            const pid = String((p as any).participantId ?? (p as any).id);
            const x = forumParticipation[pid]; // %
            const y = quizGrades[pid];         // 0–10

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
    }, [participants, forumParticipation, quizGrades]);


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
        strength: t(strengthKey, {defaultValue: "correlación prácticamente nula"}),
        direction: t(directionKey, {defaultValue: "positiva"}),
        defaultValue: "Correlación prácticamente nula (positiva)",
    });

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
                            <span className="font-semibold">{t("note.slope_title")}: </span>
                            <span>
      {t("note.slope_explainer", {
          slope: b.toFixed(3),
      })}
    </span>
                        </li>

                        <li>
                            <span className="font-semibold">{t("note.r_title")}: </span>
                            <span>
      {t("note.r_explainer", {
          r: r.toFixed(3),
          corr: corrText, // tu texto interpretativo: "débil (positiva)", etc.
      })}
    </span>
                        </li>

                        <li>
                            <span className="font-semibold">{t("note.r2_title")}: </span>
                            <span>
      {t("note.r2_explainer", {
          pct: (r2 * 100).toFixed(1),
      })}
    </span>
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

export default CorrelationsTab;
