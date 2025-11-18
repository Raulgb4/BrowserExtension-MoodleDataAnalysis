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
import {
    buildChoiceVotesByPid,
    buildEvaluableViewsVsAvgPoints,
    buildForumParticipationPct,
    buildForumViewsByPid,
    buildQuizAvgGradeMap,
    buildQuizViewsVsAvgPoints,
    buildWorkshopAvgGradeMap,
    EvaluablePoint,
    getCurrentCourseFromStorage,
    LabeledPoint
} from "../../utils/dataAggregation";
import {
    buildCorrelationPoints,
    buildCorrelationStats,
    classifyCorrelation,
    computeDynamicXAxis,
    leastSquares,
    regressionY
} from "../../utils/correlationMath";

const CorrelationsTab: React.FC = () => {
    const {t} = useTranslation();

    // Raw data loaded async (keep in state)
    const [forumParticipationPct, setForumParticipationPct] = useState<Record<string, number>>({});
    const [quizAvgGrade, setQuizAvgGrade] = useState<Record<string, number>>({});
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [forumViewsByPid, setForumViewsByPid] = useState<Record<string, number>>({});
    const [choiceVotesByPid, setChoiceVotesByPid] = useState<Record<string, number>>({});
    const [workshopAvgGradeByPid, setWorkshopAvgGradeByPid] = useState<Record<string, number>>({});
    const [excludeZeroGrades, setExcludeZeroGrades] = useState<boolean>(false);

    // Pre-aggregated points for specific correlation plots
    const [quizViewsVsAvgPoints, setQuizViewsVsAvgPoints] = useState<LabeledPoint[]>([]);
    const [evaluableViewsVsAvgPoints, setEvaluableViewsVsAvgPoints] = useState<EvaluablePoint[]>([]);

    /**
     * Fast lookup map indexed by participant ID.
     * Avoids repeatedly scanning the participant array when resolving names,
     * roles, or other participant metadata inside correlation calculations.
     */
    const participantsById = useMemo(() => {
        const m = new Map<string, Participant>();
        for (const p of participants) m.set(String(p.id), p);
        return m;
    }, [participants]);

    /**
     * Precompute XY correlation points for:
     *   X = forum participation percentage
     *   Y = quiz average grade
     *
     * This is derived data, so we keep it in a memo instead of a component state.
     * Names are resolved on-demand through `participantsById` to avoid duplication.
     */
    const xyPoints = useMemo(
        () => buildCorrelationPoints(
            forumParticipationPct,
            quizAvgGrade,
            participantsById
        ),
        [forumParticipationPct, quizAvgGrade, participantsById]
    );

    /**
     * Load all quizzes from chrome storage and derive XY points for:
     *   X = total quiz views
     *   Y = average normalized grade (0–10)
     *
     * NOTE:
     *  - A quiz may have `numViews` directly, otherwise sum participant views.
     *  - Only quizzes with valid participantStats are processed.
     */
    useEffect(() => {
        chrome.storage.local.get(null, result => {
            const courseKey = Object.keys(result).find(k => k.startsWith("course_"));
            if (!courseKey) return;

            const rawQuizzes = result[courseKey]?.quizzes;
            if (!Array.isArray(rawQuizzes)) return;

            setQuizViewsVsAvgPoints(buildQuizViewsVsAvgPoints(rawQuizzes));
        });
    }, []);

    /**
     * Load course-level data from chrome storage:
     *  - Resolve the current course (first key that matches "course_*").
     *  - Extract participants and store them in the local state.
     *  - Initialize default participant scopes for forums/quizzes in storage.
     *
     * NOTE:
     *  - Available roles and other derived structures are computed later via useMemo.
     */
    useEffect(() => {
        const loadCourseData = () => {
            chrome.storage.local.get(null, (result) => {
                const course = getCurrentCourseFromStorage(result);
                if (!course) return;

                const allParticipants = Array.isArray(course.participants) ? course.participants : [];
                setParticipants(allParticipants);

                // Initialize default scopes (not critical but keeps consistency)
                void chrome.storage.local.set({
                    participants_scope_forums: "all",
                    participants_scope_quizzes: "all",
                });
            });
        };

        loadCourseData();
    }, []);

    /**
     * Load forum-level metrics from chrome storage:
     *  - forumParticipationPct: pid -> % of participation across all forums.
     *  - forumViewsByPid: pid -> total number of forum views.
     */
    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const course = getCurrentCourseFromStorage(result);
            if (!course) return;

            const forums = Array.isArray(course.forums) ? course.forums : [];

            const pctMap = buildForumParticipationPct(forums);
            setForumParticipationPct(pctMap);

            const viewsMap = buildForumViewsByPid(forums);
            setForumViewsByPid(viewsMap);
        });
    }, []);

    /**
     * Load quiz-level average grades from chrome storage.
     *  - quizAvgGrade: quizId -> average normalized grade (0–10).
     */
    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const course = getCurrentCourseFromStorage(result);
            if (!course) return;

            const quizzes = Array.isArray(course.quizzes) ? course.quizzes : [];

            const avgGradesMap = buildQuizAvgGradeMap(quizzes);
            setQuizAvgGrade(avgGradesMap);
        });
    }, []);

    /**
     * Load evaluable activities (quizzes, workshops, assignments) and derive XY points for:
     *  X = total activity views
     *  Y = average normalized grade (0–10)
     *  activityType = Quiz | Workshop | Assignment
     */
    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const course = getCurrentCourseFromStorage(result);
            if (!course) return;

            const quizzes = Array.isArray(course.quizzes) ? course.quizzes : [];
            const workshops = Array.isArray(course.workshops) ? course.workshops : [];
            const assignments = Array.isArray(course.assignments) ? course.assignments : [];

            const points = buildEvaluableViewsVsAvgPoints(quizzes, workshops, assignments);
            setEvaluableViewsVsAvgPoints(points);
        });
    }, []);

    /**
     * Load total votes per participant for Choice activities:
     *  - choiceVotesByPid: pid -> total number of votes across all choices.
     */
    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const course = getCurrentCourseFromStorage(result);
            if (!course) return;

            const choices = Array.isArray(course.choices) ? course.choices : [];

            const votesMap = buildChoiceVotesByPid(choices);
            setChoiceVotesByPid(votesMap);
        });
    }, []);

    /**
     * Load per-participant average workshop grade (0–10) from chrome storage.
     *  - workshopAvgGradeByPid: pid -> average workshop grade.
     */
    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const course = getCurrentCourseFromStorage(result);
            if (!course) return;

            const workshops = Array.isArray(course.workshops) ? course.workshops : [];

            const avgMap = buildWorkshopAvgGradeMap(workshops);
            setWorkshopAvgGradeByPid(avgMap);
        });
    }, []);


    // ---------------------------------------------------------------------------
    // 1) Forum participation % vs average quiz grade
    // ---------------------------------------------------------------------------

    /**
     * Derived metrics for the first correlation:
     * X = forum participation percentage per participant
     * Y = average quiz grade for that participant.
     *
     * These values are used both for the scatter plot (raw points) and
     * for the regression line and qualitative correlation summary.
     */
    const {
        axis: {min: minXAxis, max: maxXAxis, stepSize},
        regression: {a, b, r, r2},
    } = useMemo(() => buildCorrelationStats(xyPoints), [xyPoints]);


    // ---------------------------------------------------------------------------
    // 2) Quiz total views vs average quiz grade
    // ---------------------------------------------------------------------------

    /**
     * X = total quiz views per participant (aggregated across all quizzes)
     * Y = average quiz grade for each participant.
     *
     * This axis computation dynamically pads min/max to create spacing in scatter plots
     * where X is an unbounded integer count.
     */
    const {
        min: minQuizX,
        max: maxQuizX,
        stepSize: stepQuizX
    } = useMemo(
        () => computeDynamicXAxis(quizViewsVsAvgPoints),
        [quizViewsVsAvgPoints]
    );


    // ---------------------------------------------------------------------------
    // 3) Total views (quizzes+workshops+assignments) vs average grade
    // ---------------------------------------------------------------------------

    /**
     * X = total views across all evaluable activities (quizzes, workshops, assignments)
     * Y = average grade across those evaluable activities.
     *
     * The X-axis range is computed dynamically with a small padding so scatter
     * points do not stick to the chart borders.
     */
    const {
        min: minEvaluableX,
        max: maxEvaluableX,
        stepSize: stepEvaluableX,
    } = useMemo(
        () => computeDynamicXAxis(evaluableViewsVsAvgPoints),
        [evaluableViewsVsAvgPoints]
    );

    const {a: aQuiz, b: bQuiz, r: rQuiz, r2: r2Quiz} = useMemo(
        () => leastSquares(quizViewsVsAvgPoints),
        [quizViewsVsAvgPoints]
    );

    const {a: aEval, b: bEval, r: rEval, r2: r2Eval} = useMemo(
        () => leastSquares(evaluableViewsVsAvgPoints),
        [evaluableViewsVsAvgPoints]
    );

    const quizPoints = useMemo(
        () =>
            evaluableViewsVsAvgPoints.filter(p => p.activityType === ActivityType.Quiz),
        [evaluableViewsVsAvgPoints]
    );
    const workshopPoints = useMemo(
        () =>
            evaluableViewsVsAvgPoints.filter(p => p.activityType === ActivityType.Workshop),
        [evaluableViewsVsAvgPoints]
    );
    const assignmentPoints = useMemo(
        () =>
            evaluableViewsVsAvgPoints.filter(p => p.activityType === ActivityType.Assignment),
        [evaluableViewsVsAvgPoints]
    );

    // Regresiones separadas por tipo de actividad (sobre los puntos ya filtrados)
    const {
        a: aQuizEval,
        b: bQuizEval,
        r: rQuizEval,
        r2: r2QuizEval,
    } = useMemo(() => leastSquares(quizPoints), [quizPoints]);

    const {
        a: aWorkshopEval,
        b: bWorkshopEval,
        r: rWorkshopEval,
        r2: r2WorkshopEval,
    } = useMemo(() => leastSquares(workshopPoints), [workshopPoints]);

    const {
        a: aAssignmentEval,
        b: bAssignmentEval,
        r: rAssignmentEval,
        r2: r2AssignmentEval,
    } = useMemo(() => leastSquares(assignmentPoints), [assignmentPoints]);


    // ---------------------------------------------------------------------------
    // 4) Forum views vs final grade
    // ---------------------------------------------------------------------------

    /**
     * X = total forum views per participant (aggregated across all forums)
     * Y = final grade for that participant (clamped to 0–10).
     */
    const xyPointsFinalViews = useMemo(() => {
        const pts: { pid: number; x: number; y: number }[] = [];

        for (const [pidStr, views] of Object.entries(forumViewsByPid)) {
            const pid = Number(pidStr);
            const student = participantsById.get(String(pid));
            const yFinal = student?.finalGrade;

            if (Number.isFinite(views) && Number.isFinite(yFinal)) {
                const x = Math.max(0, Math.floor(Number(views)));      // integer >= 0
                const y = Math.max(0, Math.min(10, Number(yFinal)));   // clamp 0..10


                if (excludeZeroGrades && y === 0) {
                    continue;
                }

                pts.push({pid, x, y});
            }
        }
        return pts;
    }, [forumViewsByPid, participantsById, excludeZeroGrades]);

    /**
     * Dynamic X-axis range for total forum views.
     * Uses a small padding so scatter points do not stick to chart borders.
     */
    const {
        min: minXAxisViews,
        max: maxXAxisViews,
        stepSize: rawStepSizeViews,
    } = useMemo(
        () => computeDynamicXAxis(xyPointsFinalViews),
        [xyPointsFinalViews]
    );

    /**
     * Force an integer step on the X axis for forum views,
     * since views are count data (0, 1, 2, ...).
     */
    const stepSizeViews = useMemo(
        () => Math.max(1, Math.round(rawStepSizeViews || 1)),
        [rawStepSizeViews]
    );

    const {a: aViews, b: bViews, r: rViews, r2: r2Views} = useMemo(
        () => leastSquares(xyPointsFinalViews),
        [xyPointsFinalViews]
    );

    // ---------------------------------------------------------------------------
    // 5) Choice votes vs workshop average grade
    // ---------------------------------------------------------------------------

    const xyPointsChoiceVotesWorkshop = useMemo(() => {
        const pts: { pid: number; x: number; y: number }[] = [];

        // Unión de PIDs que tienen votos o nota media de talleres
        const allPids = new Set<string>([
            ...Object.keys(choiceVotesByPid ?? {}),
            ...Object.keys(workshopAvgGradeByPid ?? {}),
        ]);

        for (const pidStr of allPids) {
            const pid = Number(pidStr);
            const votes = Number(choiceVotesByPid?.[pidStr] ?? 0);
            const yAvgWorkshop = Number(workshopAvgGradeByPid?.[pidStr]);

            if (Number.isFinite(yAvgWorkshop)) {
                const x = Math.max(0, Math.floor(votes));              // votos enteros >= 0
                const y = Math.max(0, Math.min(10, yAvgWorkshop));     // clamp 0..10
                pts.push({pid, x, y});
            }
        }

        return pts;
    }, [choiceVotesByPid, workshopAvgGradeByPid]);
    // Límites dinámicos del eje X (mín, máx, paso)
    const {
        min: minChoiceX,
        max: maxChoiceX,
        stepSize: stepSizeChoice,
    } = useMemo(
        () => computeDynamicXAxis(xyPointsChoiceVotesWorkshop),
        [xyPointsChoiceVotesWorkshop]
    );
    // Regresión lineal y coeficientes para esta correlación
    const {a: aChoiceW, b: bChoiceW, r: rChoiceW, r2: r2ChoiceW} = useMemo(
        () => leastSquares(xyPointsChoiceVotesWorkshop),
        [xyPointsChoiceVotesWorkshop]
    );

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
                    <ul className="mt-3 max-w-prose mx-auto text-sm sm:text-[15px] leading-relaxed text-gray-700 space-y-1">
                        <li>
                            m={b.toFixed(3)} ·
                            r={r.toFixed(3)} ({t(classifyCorrelation(r).strengthKey)}) ·
                            R²={(r2 * 100).toFixed(1)}%
                        </li>
                    </ul>

                </GraphBlock>
            ) : (
                // Empty-state fallback
                <div
                    className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl
                    shadow-md min-h-[300px] flex items-center justify-center">
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
                    <ul className="mt-3 max-w-prose mx-auto text-sm sm:text-[15px] leading-relaxed text-gray-700 space-y-1">
                        <li>
                            m={bQuiz.toFixed(3)} ·
                            r={rQuiz.toFixed(3)} ({t(classifyCorrelation(rQuiz).strengthKey)}) ·
                            R²={(r2Quiz * 100).toFixed(1)}%
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
                                data: quizPoints.map(p => ({
                                    x: p.x,
                                    y: p.y,
                                    activityName: p.label,
                                    activityType: p.activityType
                                })),
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
                                data: workshopPoints.map(p => ({
                                    x: p.x,
                                    y: p.y,
                                    activityName: p.label,
                                    activityType: p.activityType
                                })),
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
                                data: assignmentPoints.map(p => ({
                                    x: p.x,
                                    y: p.y,
                                    activityName: p.label,
                                    activityType: p.activityType
                                })),
                                pointRadius: 5,
                                pointBackgroundColor: "rgba(33,150,243,0.6)",
                                pointBorderColor: "rgba(33,150,243,1)",
                                pointHoverRadius: 7,
                                pointHoverBackgroundColor: "rgba(33,150,243,1)",
                                pointHoverBorderColor: "rgba(33,150,243,1)",
                            },
                            // Recta de regresión — QUIZZES
                            {
                                type: "line",
                                label: t("chart.regression_line_quizzes"),
                                data: [
                                    { x: minEvaluableX, y: regressionY(aQuizEval, bQuizEval, minEvaluableX) },
                                    { x: maxEvaluableX, y: regressionY(aQuizEval, bQuizEval, maxEvaluableX) },
                                ],
                                pointRadius: 0,
                                borderWidth: 2,
                                borderColor: "rgba(156,39,176,1)",    // mismo morado que los puntos
                                backgroundColor: "rgba(156,39,176,0.08)",
                                fill: false,
                                tension: 0,
                            },

                            // Recta de regresión — WORKSHOPS
                            {
                                type: "line",
                                label: t("chart.regression_line_workshops"),
                                data: [
                                    { x: minEvaluableX, y: regressionY(aWorkshopEval, bWorkshopEval, minEvaluableX) },
                                    { x: maxEvaluableX, y: regressionY(aWorkshopEval, bWorkshopEval, maxEvaluableX) },
                                ],
                                pointRadius: 0,
                                borderWidth: 2,
                                borderColor: "rgba(0,150,136,1)",     // mismo verde/teal
                                backgroundColor: "rgba(0,150,136,0.08)",
                                fill: false,
                                tension: 0,
                            },

                            // Recta de regresión — ASSIGNMENTS
                            {
                                type: "line",
                                label: t("chart.regression_line_assignments"),
                                data: [
                                    { x: minEvaluableX, y: regressionY(aAssignmentEval, bAssignmentEval, minEvaluableX) },
                                    { x: maxEvaluableX, y: regressionY(aAssignmentEval, bAssignmentEval, maxEvaluableX) },
                                ],
                                pointRadius: 0,
                                borderWidth: 2,
                                borderColor: "rgba(33,150,243,1)",    // mismo azul
                                backgroundColor: "rgba(33,150,243,0.08)",
                                fill: false,
                                tension: 0,
                            },

                            // Recta de regresión — GLOBAL (la original)
                            {
                                type: "line",
                                label: t("chart.regression_line"),
                                data: [
                                    { x: minEvaluableX, y: regressionY(aEval, bEval, minEvaluableX) },
                                    { x: maxEvaluableX, y: regressionY(aEval, bEval, maxEvaluableX) },
                                ],
                                pointRadius: 0,
                                borderWidth: 2,
                                borderColor: "rgba(249,128,18,1)",     // naranja
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
                    <ul className="mt-3 max-w-prose mx-auto text-sm sm:text-[15px] leading-relaxed text-gray-700 space-y-1">

                        {/* Quizzes */}
                        <li>
                            <span className="font-semibold">{t("legend.quizzes")}:</span>
                            {" "}
                            m={aQuizEval.toFixed(3)} ·
                            r={rQuizEval.toFixed(3)} ({t(classifyCorrelation(rQuizEval).strengthKey)}) ·
                            R²={(r2QuizEval * 100).toFixed(1)}%
                        </li>

                        {/* Workshops */}
                        <li>
                            <span className="font-semibold">{t("legend.workshops")}:</span>
                            {" "}
                            m={aWorkshopEval.toFixed(3)} ·
                            r={rWorkshopEval.toFixed(3)} ({t(classifyCorrelation(rWorkshopEval).strengthKey)}) ·
                            R²={(r2WorkshopEval * 100).toFixed(1)}%
                        </li>

                        {/* Assignments */}
                        <li>
                            <span className="font-semibold">{t("legend.assignments")}:</span>
                            {" "}
                            m={aAssignmentEval.toFixed(3)} ·
                            r={rAssignmentEval.toFixed(3)} ({t(classifyCorrelation(rAssignmentEval).strengthKey)}) ·
                            R²={(r2AssignmentEval * 100).toFixed(1)}%
                        </li>

                        {/* Global */}
                        <li>
                            <span className="font-semibold">{t("legend.all_types")}:</span>
                            {" "}
                            m={aEval.toFixed(3)} ·
                            r={rEval.toFixed(3)} ({t(classifyCorrelation(rEval).strengthKey)}) ·
                            R²={(r2Eval * 100).toFixed(1)}%
                        </li>

                    </ul>

                </GraphBlock>
            ) : (
                <div
                    className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md
                    min-h-[300px] flex items-center justify-center">
                    <p className="text-base text-orange-600 font-semibold">
                        {t("note.not_enough_points")}
                    </p>
                </div>
            )}


            {/* Scatter: forum views (X) vs. final course grade (Y) */}
            {xyPointsFinalViews.length >= 3 ? (
                <GraphBlock
                    title={t("chart.predictive.forum_views_vs_final_grade")}
                    chartType="scatter"
                    data={{
                        datasets: [
                            {
                                type: "scatter",
                                label: t("legend.students"),
                                data: xyPointsFinalViews.map((p) => ({
                                    x: p.x,
                                    y: p.y,
                                    studentName:
                                        participantsById.get(String(p.pid))?.participantName ?? String(p.pid),
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
                                    {x: minXAxisViews, y: regressionY(aViews, bViews, minXAxisViews)},
                                    {x: maxXAxisViews, y: regressionY(aViews, bViews, maxXAxisViews)},
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
                                title: {display: true, text: t("axis.forum_views")},
                                min: minXAxisViews,
                                max: maxXAxisViews,
                                ticks: {
                                    stepSize: stepSizeViews,
                                    callback: (value) => {
                                        const n = Number(value);
                                        return Number.isFinite(n) ? n.toFixed(0) : value;
                                    },
                                },
                            },
                            y: {
                                title: {display: true, text: t("axis.final_grade_0_10")},
                                min: 0,
                                max: 10,
                            },
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: (items) => {
                                        const raw = items?.[0]?.raw as any;
                                        return raw?.studentName ?? t("legend.students");
                                    },
                                    label: (ctx) => {
                                        const x = ctx.parsed.x?.toFixed?.(0) ?? ctx.parsed.x;
                                        const y = ctx.parsed.y?.toFixed?.(2) ?? ctx.parsed.y;
                                        return `${x} ${t("legend.visits")} · ${y}/10`;
                                    },
                                },
                            },
                        },
                    }}
                >
                    <div className="flex flex-col items-center justify-center my-4 space-y-3">

                        {/* Checkbox */}
                        <label
                            className="inline-flex items-center cursor-pointer space-x-2 select-none
                   bg-orange-50 px-3 py-1 rounded-full border border-orange-200
                   hover:bg-orange-100 transition-colors"
                        >
                            <input
                                type="checkbox"
                                className="form-checkbox h-4 w-4 text-orange-600 rounded border-orange-300
                       focus:ring-orange-500 transition duration-150 ease-in-out"
                                checked={excludeZeroGrades}
                                onChange={(e) => setExcludeZeroGrades(e.target.checked)}
                            />
                            <span className="text-sm text-orange-700 font-medium">
            {t("filter.exclude_zeros") || "Excluir estudiantes con nota = 0"}
        </span>
                        </label>

                        {/* Resumen de correlación */}
                        <ul className="text-sm sm:text-[15px] leading-relaxed text-gray-700">
                            <li>
                                m={bViews.toFixed(3)} ·
                                r={rViews.toFixed(3)} ({t(classifyCorrelation(rViews).strengthKey)}) ·
                                R²={(r2Views * 100).toFixed(1)}%
                            </li>
                        </ul>

                    </div>


                </GraphBlock>
            ) : (
                <div
                    className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md
                    min-h-[300px] flex items-center justify-center">
                    <p className="text-base text-orange-600 font-semibold">
                        {t("state.no_predictive_data")}
                    </p>
                </div>
            )}


            {/* Scatter: choice votes (X) vs workshop average grade (Y) */}
            {xyPointsChoiceVotesWorkshop.length >= 3 ? (
                <GraphBlock
                    title={t("chart.predictive.choice_votes_vs_workshop_grade")}
                    chartType="scatter"
                    data={{
                        datasets: [
                            {
                                type: "scatter",
                                label: t("legend.students"),
                                data: xyPointsChoiceVotesWorkshop.map((p) => ({
                                    x: p.x, // total choice votes (sum across all choices)
                                    y: p.y, // average workshop grade 0–10
                                    studentName:
                                        participantsById.get(String(p.pid))?.participantName ?? String(p.pid),
                                })),
                                pointRadius: 4,
                                pointBackgroundColor: "rgba(100,181,246,0.6)",
                                pointBorderColor: "rgba(100,181,246,1)",
                                pointHoverRadius: 6,
                                pointHoverBackgroundColor: "rgba(100,181,246,1)",
                                pointHoverBorderColor: "rgba(100,181,246,1)",
                            },
                            // Recta de regresión: y = a*x + b
                            {
                                type: "line",
                                label: t("chart.regression_line"),
                                data: [
                                    {x: minChoiceX, y: regressionY(aChoiceW, bChoiceW, minChoiceX)},
                                    {x: maxChoiceX, y: regressionY(aChoiceW, bChoiceW, maxChoiceX)},
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
                                title: {display: true, text: t("axis.choice_votes")},
                                min: minChoiceX,
                                max: maxChoiceX,
                                ticks: {
                                    stepSize: stepSizeChoice, // paso "bonito" según tus datos
                                },
                            },
                            y: {
                                title: {display: true, text: t("axis.workshop_avg_grade_0_10")},
                                min: 0,
                                max: 10,
                            },
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: (items) => {
                                        const raw = items?.[0]?.raw as any;
                                        return raw?.studentName ?? t("legend.students");
                                    },
                                    label: (ctx) => {
                                        const x = ctx.parsed.x?.toFixed?.(0) ?? ctx.parsed.x;
                                        const y = ctx.parsed.y?.toFixed?.(2) ?? ctx.parsed.y;
                                        return `${x} ${t("legend.votes")} · ${y}/10`;
                                    },
                                },
                            },
                        },
                    }}
                >
                    {/* Resumen de correlación */}
                    <ul className="mt-3 max-w-prose mx-auto text-sm sm:text-[15px] leading-relaxed text-gray-700 space-y-1">
                        <li>
                            m={aChoiceW.toFixed(3)} ·
                            r={rChoiceW.toFixed(3)} ({t(classifyCorrelation(rChoiceW).strengthKey)}) ·
                            R²={(r2ChoiceW * 100).toFixed(1)}%
                        </li>
                    </ul>

                </GraphBlock>
            ) : (
                <div
                    className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md
                    min-h-[300px] flex items-center justify-center">
                    <p className="text-base text-orange-600 font-semibold">
                        {t("state.no_predictive_data")}
                    </p>
                </div>
            )}


        </div>
    );
};

export default CorrelationsTab;
