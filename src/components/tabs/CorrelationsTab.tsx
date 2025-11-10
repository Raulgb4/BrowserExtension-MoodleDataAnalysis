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
import {ActivityType, Participant} from "../../models/Participant";
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

    const [quizViewsVsAvgPoints, setQuizViewsVsAvgPoints] = useState<Array<{
        x: number;
        y: number;
        label: string
    }>>([]);
    const [evaluableViewsVsAvgPoints, setEvaluableViewsVsAvgPoints] = useState<
        Array<{ x: number; y: number; label: string; activityType: ActivityType }>
    >([]);

    // Choice votes (X) vs Workshop avg grade (Y)
    const [choiceWorkshopPoints, setChoiceWorkshopPoints] = useState<
        Array<{ x: number; y: number; choiceName: string; workshopName: string }>
    >([]);

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
        // Retrieve quizzes from local storage
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const rawQuizzes = result[courseKey]?.quizzes;
            if (!Array.isArray(rawQuizzes)) return;

            // Filtrar solo cuestionarios con participantStats válidos
            const quizzes: any[] = rawQuizzes.filter(
                (quiz: any) =>
                    quiz &&
                    Array.isArray(quiz.participantStats) &&
                    quiz.participantStats.length > 0
            );

            const points: Array<{ x: number; y: number; label: string }> = [];

            for (const q of quizzes) {
                // Extraer el nombre original del cuestionario
                const label =
                    q?.name?.trim?.() ||
                    q?.title?.trim?.() ||
                    q?.quizName?.trim?.() ||
                    q?.activityName?.trim?.() ||
                    `Cuestionario ${q?.id ?? ""}`;

                // X: total de visitas del cuestionario (usa numViews si existe, si no, suma las vistas de los participantes)
                const x =
                    typeof q?.numViews === "number"
                        ? q.numViews
                        : q.participantStats.reduce(
                            (acc: number, p: any) => acc + (p?.numViews || 0),
                            0
                        );

                // Y: nota media normalizada del cuestionario (media de normalizedGrade de sus participantes)
                const grades = q.participantStats
                    .map((p: any) => p?.normalizedGrade)
                    .filter((g: any) => typeof g === "number");

                if (grades.length > 0) {
                    const y = grades.reduce((a: number, b: number) => a + b, 0) / grades.length;
                    points.push({x, y, label});
                }
            }

            setQuizViewsVsAvgPoints(points);
        });
    }, []);

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

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey] ?? {};

            // Listas seguras
            const quizzes: any[] = Array.isArray(course?.quizzes) ? course.quizzes : [];
            const workshops: any[] = Array.isArray(course?.workshops) ? course.workshops : [];
            const assignments: any[] = Array.isArray(course?.assignments) ? course.assignments : [];

            // Helper: nombre legible
            const getName = (a: any, fallbackPrefix: string) =>
                a?.name?.trim?.() ||
                a?.title?.trim?.() ||
                a?.activityName?.trim?.() ||
                `${fallbackPrefix} ${a?.id ?? ""}`;

            // Helper: visitas totales (preferir ActivityBase.numViews)
            const getTotalViews = (a: any): number => {
                if (typeof a?.numViews === "number") return a.numViews;
                const stats = Array.isArray(a?.participantStats) ? a.participantStats : [];
                // fallback por si algún modelo trae numViews por participante
                const sum = stats.reduce(
                    (acc: number, p: any) => acc + (typeof p?.numViews === "number" ? p.numViews : 0),
                    0
                );
                return sum > 0 ? sum : 0;
            };

            // Helper: nota media normalizada (0–10)
            // - Quizzes: usar participantStats[].normalizedGrade
            // - Workshops/Assignments: usar participantStats[].grade (ya viene 0–10)
            const getAvgNormalizedGrade = (a: any): number | null => {
                const stats = Array.isArray(a?.participantStats) ? a.participantStats : [];
                if (stats.length === 0) return null;

                // 1) Intentar con normalizedGrade (quizzes)
                const normVals: number[] = stats
                    .map((p: any) => (typeof p?.normalizedGrade === "number" ? p.normalizedGrade : NaN))
                    .filter((v: number) => Number.isFinite(v));

                if (normVals.length > 0) {
                    const sumNorm = normVals.reduce((s: number, v: number) => s + v, 0);
                    const avgNorm = sumNorm / normVals.length;
                    return Math.max(0, Math.min(10, avgNorm));
                }

                // 2) Si no hay normalizedGrade, usar grade (workshops/assignments ya 0–10)
                const gradesNum: number[] = stats
                    .map((p: any) => (typeof p?.grade === "number" ? p.grade : NaN))
                    .filter((v: number) => Number.isFinite(v));

                if (gradesNum.length === 0) return null;

                const sumGrades = gradesNum.reduce((s: number, v: number) => s + v, 0);
                const avgRaw = sumGrades / gradesNum.length;
                return Math.max(0, Math.min(10, avgRaw));
            };


            const points: Array<{ x: number; y: number; label: string; activityType: ActivityType }> = [];

            // Quizzes
            for (const q of quizzes) {
                const y = getAvgNormalizedGrade(q);
                if (y == null) continue;
                const x = getTotalViews(q);
                points.push({
                    x,
                    y,
                    label: getName(q, "Quiz"),
                    activityType: ActivityType.Quiz,
                });
            }

            // Workshops
            for (const w of workshops) {
                const y = getAvgNormalizedGrade(w);
                if (y == null) continue;
                const x = getTotalViews(w);
                points.push({
                    x,
                    y,
                    label: getName(w, "Workshop"),
                    activityType: ActivityType.Workshop,
                });
            }

            // Assignments
            for (const a of assignments) {
                const y = getAvgNormalizedGrade(a);
                if (y == null) continue;
                const x = getTotalViews(a);
                points.push({
                    x,
                    y,
                    label: getName(a, "Assignment"),
                    activityType: ActivityType.Assignment,
                });
            }

            setEvaluableViewsVsAvgPoints(points);
        });
    }, []);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey] ?? {};
            const choices: any[] = Array.isArray(course?.choices) ? course.choices : [];
            const workshops: any[] = Array.isArray(course?.workshops) ? course.workshops : [];

            const getName = (a: any, fallback: string) =>
                a?.activityName?.trim?.() || a?.name?.trim?.() || a?.title?.trim?.() || `${fallback} ${a?.id ?? ""}`;

            const getTotalVotesFromChoice = (c: any): number => {
                const rc = c?.responseCounts && typeof c.responseCounts === "object" ? c.responseCounts : {};
                const values = Object.values(rc) as number[];
                return values.reduce((acc: number, v: number) => acc + (Number.isFinite(v) ? v : 0), 0);
            };

            const getWorkshopAvgGrade = (w: any): number | null => {
                const stats = Array.isArray(w?.participantStats) ? w.participantStats : [];
                if (stats.length === 0) return null;
                const grades: number[] = stats
                    .map((s: any) => (typeof s?.grade === "number" ? s.grade : NaN))
                    .filter((v: number) => Number.isFinite(v));
                if (grades.length === 0) return null;
                const sum = grades.reduce((s: number, v: number) => s + v, 0);
                const avg = sum / grades.length; // ya viene 0–10
                return Math.max(0, Math.min(10, avg));
            };

            // Emparejamos por índice (Choice[i] ↔ Workshop[i]) como criterio determinista simple
            const minLen = Math.min(choices.length, workshops.length);
            const pts: Array<{ x: number; y: number; choiceName: string; workshopName: string }> = [];

            for (let i = 0; i < minLen; i++) {
                const c = choices[i];
                const w = workshops[i];
                const x = getTotalVotesFromChoice(c);
                const y = getWorkshopAvgGrade(w);
                if (y == null) continue;

                pts.push({
                    x,
                    y,
                    choiceName: getName(c, "Choice"),
                    workshopName: getName(w, "Workshop"),
                });
            }

            setChoiceWorkshopPoints(pts);
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

    const {min: minQuizX, max: maxQuizX, stepSize: stepQuizX} = useMemo(() => {
        // Si tu computeXAxisBounds soporta omitir el 2º parámetro, úsalo así:
        // return computeXAxisBounds(quizViewsVsAvgPoints);
        // Si no, calculamos unos márgenes "agradables":
        if (quizViewsVsAvgPoints.length === 0) return {min: 0, max: 1, stepSize: 1};
        const xs = quizViewsVsAvgPoints.map(p => p.x);
        const rawMin = Math.min(...xs);
        const rawMax = Math.max(...xs);
        const pad = Math.max(1, Math.round((rawMax - rawMin) * 0.05));
        const min = Math.max(0, rawMin - pad);
        const max = rawMax + pad;
        // paso aproximado en 5-6 ticks
        const stepSize = Math.max(1, Math.round((max - min) / 6));
        return {min, max, stepSize};
    }, [quizViewsVsAvgPoints]);

    const {
        min: minEvaluableX,
        max: maxEvaluableX,
        stepSize: stepEvaluableX,
    } = useMemo(() => {
        if (evaluableViewsVsAvgPoints.length === 0) {
            return { min: 0, max: 1, stepSize: 1 };
        }
        const xs = evaluableViewsVsAvgPoints.map((p) => p.x);
        const rawMin = Math.min(...xs);
        const rawMax = Math.max(...xs);
        const pad = Math.max(1, Math.round((rawMax - rawMin) * 0.05));
        const min = Math.max(0, rawMin - pad);
        const max = rawMax + pad;
        const stepSize = Math.max(1, Math.round((max - min) / 6));
        return { min, max, stepSize };
    }, [evaluableViewsVsAvgPoints]);


    const {a: aQuiz, b: bQuiz, r: rQuiz, r2: r2Quiz} = useMemo(
        () => leastSquares(quizViewsVsAvgPoints),
        [quizViewsVsAvgPoints]
    );

    const quizCorrText = useMemo(() => {
        const {strengthKey, directionKey} = classifyCorrelation(rQuiz);
        return t("note.corr.template", {strength: t(strengthKey), direction: t(directionKey)});
    }, [rQuiz, t]);

    const { a: aEval, b: bEval, r: rEval, r2: r2Eval } = useMemo(
        () => leastSquares(evaluableViewsVsAvgPoints),
        [evaluableViewsVsAvgPoints]
    );

    const evaluableCorrText = useMemo(() => {
        const { strengthKey, directionKey } = classifyCorrelation(rEval);
        return t("note.corr.template", {
            strength: t(strengthKey),
            direction: t(directionKey),
        });
    }, [rEval, t]);

    const quizPoints = useMemo(
        () => evaluableViewsVsAvgPoints.filter(p => p.activityType === ActivityType.Quiz),
        [evaluableViewsVsAvgPoints]
    );
    const workshopPoints = useMemo(
        () => evaluableViewsVsAvgPoints.filter(p => p.activityType === ActivityType.Workshop),
        [evaluableViewsVsAvgPoints]
    );
    const assignmentPoints = useMemo(
        () => evaluableViewsVsAvgPoints.filter(p => p.activityType === ActivityType.Assignment),
        [evaluableViewsVsAvgPoints]
    );

    // Bounds X para Choice ↔ Workshop (mismo patrón que quiz/evaluable)
    const { min: minCWX, max: maxCWX, stepSize: stepCWX } = useMemo(() => {
        if (choiceWorkshopPoints.length === 0) return { min: 0, max: 1, stepSize: 1 };
        const xs = choiceWorkshopPoints.map((p) => p.x);
        const rawMin = Math.min(...xs);
        const rawMax = Math.max(...xs);
        const pad = Math.max(1, Math.round((rawMax - rawMin) * 0.05));
        const min = Math.max(0, rawMin - pad);
        const max = rawMax + pad;
        const stepSize = Math.max(1, Math.round((max - min) / 6));
        return { min, max, stepSize };
    }, [choiceWorkshopPoints]);

// Regresión y métricas para Choice ↔ Workshop
    const { a: aCW, b: bCW, r: rCW, r2: r2CW } = useMemo(
        () => leastSquares(choiceWorkshopPoints),
        [choiceWorkshopPoints]
    );

// Texto cualitativo de correlación (i18n)
    const cwCorrText = useMemo(() => {
        const { strengthKey, directionKey } = classifyCorrelation(rCW);
        return t("note.corr.template", {
            strength: t(strengthKey),
            direction: t(directionKey),
        });
    }, [rCW, t]);



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


            {/* Scatter: quiz total views (X) vs average quiz grade (Y) */}
            {quizViewsVsAvgPoints.length >= 2 ? (
                <GraphBlock
                    title={t("chart.predictive.quiz_views_vs_grade")}
                    chartType="scatter"
                    data={{
                        datasets: [
                            {
                                type: "scatter",
                                label: t("legend.quizzes"),
                                data: quizViewsVsAvgPoints.map((q) => ({
                                    x: q.x,
                                    y: q.y,
                                    quizName: q.label,
                                })),
                                pointRadius: 5,
                                pointBackgroundColor: "rgba(156,39,176,0.6)",
                                pointBorderColor: "rgba(156,39,176,1)",
                                pointHoverRadius: 7,
                                pointHoverBackgroundColor: "rgba(156,39,176,1)",
                                pointHoverBorderColor: "rgba(156,39,176,1)",
                            },
                            {
                                type: "line",
                                label: t("chart.regression_line"),
                                data: [
                                    {x: minQuizX, y: regressionY(aQuiz, bQuiz, minQuizX)},
                                    {x: maxQuizX, y: regressionY(aQuiz, bQuiz, maxQuizX)},
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
                                title: {display: true, text: t("axis.quiz_total_views")}, // <- QUIZ, no evaluable
                                min: minQuizX,         // <- QUIZ bounds
                                max: maxQuizX,         // <- QUIZ bounds
                                ticks: {
                                    stepSize: stepQuizX, // <- QUIZ step
                                    precision: 0,
                                    callback: (value) => Math.round(value as number).toString(),
                                },
                            },
                            y: {
                                title: {display: true, text: t("axis.quiz_grade_0_10")}, // <- QUIZ label
                                min: 0,
                                max: 10,
                            },
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: (items) => {
                                        const raw = items?.[0]?.raw as any;
                                        return raw?.quizName ?? t("legend.quizzes");
                                    },
                                    label: (ctx) => {
                                        const x = ctx.parsed.x?.toFixed?.(0) ?? ctx.parsed.x;
                                        const y = ctx.parsed.y?.toFixed?.(2) ?? ctx.parsed.y;
                                        return `${t("axis.quiz_total_views")}: ${x} · ${t("axis.quiz_grade_0_10")}: ${y}/10`;
                                    },
                                },
                            },
                        },
                    }}
                >
                    {/* Resumen de correlación */}
                    <ul className="mt-3 max-w-prose mx-auto list-disc list-inside text-sm sm:text-[15px] leading-relaxed text-gray-700 space-y-1">
                        <li>
                            <span className="font-semibold">{t("note.slope_title")}: </span>
                            {t("note.slope_explainer", {slope: bQuiz.toFixed(3)})}
                        </li>
                        <li>
                            <span className="font-semibold">{t("note.r_title")}: </span>
                            {t("note.r_explainer", {r: rQuiz.toFixed(3), corr: quizCorrText})}
                        </li>
                        <li>
                            <span className="font-semibold">{t("note.r2_title")}: </span>
                            {t("note.r2_explainer", {pct: (r2Quiz * 100).toFixed(1)})}
                        </li>
                    </ul>
                </GraphBlock>
            ) : null}


            {/* Scatter: evaluables total views (X) vs average grade (Y) */}
            {evaluableViewsVsAvgPoints.length >= 2 ? (
                <GraphBlock
                    title={t("chart.predictive.evaluable_views_vs_avg_grade")}
                    chartType="scatter"
                    data={{
                        datasets: [
                            // Quizzes (morado)
                            {
                                type: "scatter",
                                label: t("legend.quizzes"),
                                data: quizPoints.map(p => ({ x: p.x, y: p.y, activityName: p.label, activityType: p.activityType })),
                                pointRadius: 5,
                                pointBackgroundColor: "rgba(156,39,176,0.6)",
                                pointBorderColor: "rgba(156,39,176,1)",
                                pointHoverRadius: 7,
                                pointHoverBackgroundColor: "rgba(156,39,176,1)",
                                pointHoverBorderColor: "rgba(156,39,176,1)",
                            },
                            // Workshops (verde/teal)
                            {
                                type: "scatter",
                                label: t("legend.workshops"),
                                data: workshopPoints.map(p => ({ x: p.x, y: p.y, activityName: p.label, activityType: p.activityType })),
                                pointRadius: 5,
                                pointBackgroundColor: "rgba(0,150,136,0.6)",
                                pointBorderColor: "rgba(0,150,136,1)",
                                pointHoverRadius: 7,
                                pointHoverBackgroundColor: "rgba(0,150,136,1)",
                                pointHoverBorderColor: "rgba(0,150,136,1)",
                            },
                            // Assignments (azul)
                            {
                                type: "scatter",
                                label: t("legend.assignments"),
                                data: assignmentPoints.map(p => ({ x: p.x, y: p.y, activityName: p.label, activityType: p.activityType })),
                                pointRadius: 5,
                                pointBackgroundColor: "rgba(33,150,243,0.6)",
                                pointBorderColor: "rgba(33,150,243,1)",
                                pointHoverRadius: 7,
                                pointHoverBackgroundColor: "rgba(33,150,243,1)",
                                pointHoverBorderColor: "rgba(33,150,243,1)",
                            },
                            // Recta de regresión (sobre todos los puntos)
                            {
                                type: "line",
                                label: t("chart.regression_line"),
                                data: [
                                    { x: minEvaluableX, y: regressionY(aEval, bEval, minEvaluableX) },
                                    { x: maxEvaluableX, y: regressionY(aEval, bEval, maxEvaluableX) },
                                ],
                                pointRadius: 0,
                                borderWidth: 2,
                                borderColor: "rgba(249,128,18,1)",     // mismo naranja
                                backgroundColor: "rgba(249,128,18,0.08)",
                                fill: false,
                                tension: 0,
                            },
                        ]
                    }}

                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                title: {display: true, text: t("axis.evaluable_total_views")}, // NUEVA clave i18n
                                min: minEvaluableX,
                                max: maxEvaluableX,
                                ticks: {
                                    stepSize: stepEvaluableX,
                                    precision: 0,
                                    callback: (value) => Math.round(value as number).toString(),
                                },
                            },
                            y: {
                                title: {display: true, text: t("axis.evaluable_avg_grade_0_10")}, // NUEVA clave i18n
                                min: 0,
                                max: 10,
                            },
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: (items) => {
                                        const raw = items?.[0]?.raw as any;
                                        const name = raw?.activityName ?? t("legend.activities");
                                        const type = raw?.activityType ? ` (${raw.activityType})` : "";
                                        return name + type;
                                    },
                                    label: (ctx) => {
                                        const x = ctx.parsed.x?.toFixed?.(0) ?? ctx.parsed.x;
                                        const y = ctx.parsed.y?.toFixed?.(2) ?? ctx.parsed.y;
                                        return `${t("axis.evaluable_total_views")}: ${x} · ${t("axis.evaluable_avg_grade_0_10")}: ${y}/10`;
                                    },
                                },
                            },
                        },
                    }}
                >
                    {/* Resumen de correlación (mismo esquema que el primero) */}
                    <ul className="mt-3 max-w-prose mx-auto list-disc list-inside text-sm sm:text-[15px] leading-relaxed text-gray-700 space-y-1">
                        <li>
                            <span className="font-semibold">{t("note.slope_title")}: </span>
                            {/* La pendiente es 'a' */}
                            {t("note.slope_explainer", {slope: aEval.toFixed(3)})}
                        </li>
                        <li>
                            <span className="font-semibold">{t("note.r_title")}: </span>
                            {/* Si ya tienes un texto cualitativo (e.g., evaluableCorrText), úsalo aquí;
            si no, mostramos el valor numérico con 3 decimales */}
                            {t("note.r_explainer", {
                                r: rEval.toFixed(3),
                                corr: (typeof evaluableCorrText === "string" ? evaluableCorrText : rEval.toFixed(3))
                            })}
                        </li>
                        <li>
                            <span className="font-semibold">{t("note.r2_title")}: </span>
                            {t("note.r2_explainer", {pct: (r2Eval * 100).toFixed(1)})}
                        </li>
                    </ul>
                </GraphBlock>
            ) : (
                <div
                    className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md min-h-[300px] flex items-center justify-center">
                    <p className="text-base text-orange-600 font-semibold">
                        {t("note.not_enough_points")}
                    </p>
                </div>
            )}

            {/* Scatter: choice total votes (X) vs workshop average grade (Y) */}
            {choiceWorkshopPoints.length >= 2 ? (
                <GraphBlock
                    title={t("chart.predictive.choice_votes_vs_workshop_grade")}
                    chartType="scatter"
                    data={{
                        datasets: [
                            {
                                type: "scatter",
                                label: t("legend.choices_vs_workshops"),
                                data: choiceWorkshopPoints.map((p) => ({
                                    x: p.x, // total votes in Choice
                                    y: p.y, // average grade in Workshop (0–10)
                                    choiceName: p.choiceName,
                                    workshopName: p.workshopName,
                                })),
                                pointRadius: 5,
                                pointBackgroundColor: "rgba(63,81,181,0.6)",
                                pointBorderColor: "rgba(63,81,181,1)",
                                pointHoverRadius: 7,
                                pointHoverBackgroundColor: "rgba(63,81,181,1)",
                                pointHoverBorderColor: "rgba(63,81,181,1)",
                            },
                            {
                                type: "line",
                                label: t("chart.regression_line"),
                                data: [
                                    { x: minCWX, y: regressionY(aCW, bCW, minCWX) },
                                    { x: maxCWX, y: regressionY(aCW, bCW, maxCWX) },
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
                                title: { display: true, text: t("axis.choice_total_votes") },
                                min: minCWX,
                                max: maxCWX,
                                ticks: {
                                    stepSize: stepCWX,
                                    precision: 0,
                                    callback: (value) => Math.round(value as number).toString(),
                                },
                            },
                            y: {
                                title: { display: true, text: t("axis.workshop_avg_grade_0_10") },
                                min: 0,
                                max: 10,
                            },
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: (items) => {
                                        const raw = items?.[0]?.raw as any;
                                        const c = raw?.choiceName ?? "Choice";
                                        const w = raw?.workshopName ?? "Workshop";
                                        return `${c} ↔ ${w}`;
                                    },
                                    label: (ctx) => {
                                        const x = ctx.parsed.x?.toFixed?.(0) ?? ctx.parsed.x;
                                        const y = ctx.parsed.y?.toFixed?.(2) ?? ctx.parsed.y;
                                        return `${t("axis.choice_total_votes")}: ${x} · ${t("axis.workshop_avg_grade_0_10")}: ${y}/10`;
                                    },
                                },
                            },
                        },
                    }}
                >
                    {/* Resumen de correlación */}
                    <ul className="mt-3 max-w-prose mx-auto list-disc list-inside text-sm sm:text-[15px] leading-relaxed text-gray-700 space-y-1">
                        <li>
                            <span className="font-semibold">{t("note.slope_title")}: </span>
                            {t("note.slope_explainer", { slope: aCW.toFixed(3) })}
                        </li>
                        <li>
                            <span className="font-semibold">{t("note.r_title")}: </span>
                            {t("note.r_explainer", { r: rCW.toFixed(3), corr: cwCorrText })}
                        </li>
                        <li>
                            <span className="font-semibold">{t("note.r2_title")}: </span>
                            {t("note.r2_explainer", { pct: (r2CW * 100).toFixed(1) })}
                        </li>
                    </ul>
                </GraphBlock>
            ) : null}




        </div>
    );
};

export default CorrelationsTab;
