/**
 * @file dataAggregation.ts
 *
 * @description
 * Data aggregation utilities used to compute participant-level metrics
 * from raw Moodle activity data within the Moodle Data Analyzer extension.
 *
 * Provides helper functions for:
 *  - Calculating relative forum participation percentages per participant
 *    based on total discussions, replies, and views.
 *  - Computing average normalized quiz grades (0–10) for each participant,
 *    handling both numeric and localized decimal string inputs.
 *
 * These aggregations serve as the numerical foundations for the correlation
 * analysis modules, enabling the generation of predictive charts that relate
 * student engagement metrics to academic performance indicators.
 *
 * @author Raúl García Balongo
 * @date 2025
 */
import {ActivityType} from "../models/Participant";
import {Course} from "../models/Course";


// Minimal types — adjust to your real shapes if you have them exported
type ForumStat = {
    participantId: string | number;
    discussionsPosted?: number;
    repliesPosted?: number;
    views?: number;
};

type Forum = {
    participantsStats?: ForumStat[];
};

export interface LabeledPoint {
    x: number;
    y: number;
    label: string;
}

export interface EvaluablePoint extends LabeledPoint {
    activityType: ActivityType;
}

export function getCurrentCourseFromStorage(result: Record<string, any>): Course | null {
    const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
    if (!courseKey) return null;
    return result[courseKey] ?? null;
}

/**
 * Builds a map pid -> % of total forum activity across the course.
 * % is computed against the grand total of (discussions + replies + views).
 * Returns values rounded to 2 decimals.
 */
export function buildForumParticipationPct(forums: Forum[]): Record<string, number> {
    const perPidTotals: Record<string, number> = {};
    let grandTotal = 0;

    for (const f of forums) {
        const stats = Array.isArray(f?.participantsStats) ? f.participantsStats : [];
        for (const s of stats) {
            const pid = String(s.participantId);
            const total = (s.discussionsPosted ?? 0) + (s.repliesPosted ?? 0) + (s.views ?? 0);
            perPidTotals[pid] = (perPidTotals[pid] ?? 0) + total;
            grandTotal += total;
        }
    }

    if (grandTotal <= 0) return {};

    const participationMap: Record<string, number> = {};
    for (const pid of Object.keys(perPidTotals)) {
        const pct = (perPidTotals[pid] / grandTotal) * 100;
        participationMap[pid] = Math.round(pct * 100) / 100; // 2 decimals
    }
    return participationMap;
}

export function buildForumViewsByPid(forums: any[]): Record<string, number> {
    const viewsMap: Record<string, number> = {};

    for (const f of forums) {
        const stats = Array.isArray(f?.participantsStats) ? f.participantsStats : [];
        for (const s of stats) {
            const pid = String(s.participantId);
            const v = Number(s?.views ?? 0);
            if (Number.isFinite(v) && v > 0) {
                viewsMap[pid] = (viewsMap[pid] ?? 0) + v;
            }
        }
    }

    return viewsMap;
}

/**
 * Builds a map pid -> average normalized quiz grade (0–10).
 * Handles comma/point decimals and ignores invalid values.
 */
export function buildQuizAvgGradeMap(quizzes: any[]): Record<string, number> {
    const perPidGrades: Record<string, number[]> = {};

    const toNumber = (v: any) =>
        typeof v === "number"
            ? v
            : typeof v === "string"
                ? parseFloat(v.replace(",", "."))
                : NaN;

    for (const q of quizzes) {
        const stats: any[] = Array.isArray(q?.participantStats) ? q.participantStats : [];
        for (const s of stats) {
            const pid = String(s.participantId);
            const g10 = toNumber(s.normalizedGrade);
            if (Number.isFinite(g10)) {
                const clamped = Math.max(0, Math.min(10, g10)); // keep within 0–10
                (perPidGrades[pid] ??= []).push(clamped);
            }
        }
    }

    const gradesMap: Record<string, number> = {};
    for (const pid of Object.keys(perPidGrades)) {
        const arr = perPidGrades[pid];
        if (arr.length === 0) continue;
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        gradesMap[pid] = Math.round(avg * 100) / 100; // 2 decimals
    }

    return gradesMap;
}

/**
 * Build a map of average workshop grades per participant.
 *
 * Returns:
 *  - pid -> average workshop grade in [0, 10].
 *
 * NOTE:
 *  - Assumes participantStats[].grade is already normalized to 0–10.
 */
export function buildWorkshopAvgGradeMap(workshops: any[]): Record<string, number> {
    const perPidGrades: Record<string, number[]> = {};

    const toNumber = (v: any) =>
        typeof v === "number"
            ? v
            : typeof v === "string"
                ? parseFloat(v.replace(",", "."))
                : NaN;

    for (const w of workshops ?? []) {
        const stats: any[] = Array.isArray(w?.participantStats) ? w.participantStats : [];

        // Intento de detectar máximo para normalizar si viniera sin 0–10
        // (algunos Moodle exponen maxGrade/gradingMax/maxgrade en el propio workshop)
        const rawMax =
            toNumber(w?.maxGrade) ??
            toNumber(w?.gradingMax) ??
            toNumber(w?.maxgrade);
        const maxForScale = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 10;

        for (const s of stats) {
            const pid = String(s.participantId);
            const gRaw = toNumber(s?.grade);
            if (!Number.isFinite(gRaw)) continue;

            // Si ya viene 0–10, esto no lo altera; si viene 0–max, lo normaliza a 0–10.
            const g10 = Math.max(0, Math.min(10, (gRaw / maxForScale) * 10));

            (perPidGrades[pid] ??= []).push(g10);
        }
    }

    const gradesMap: Record<string, number> = {};
    for (const [pid, arr] of Object.entries(perPidGrades)) {
        if (!arr.length) continue;
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        gradesMap[pid] = Math.round(avg * 100) / 100; // 2 decimales
    }

    return gradesMap;
}

export function buildQuizViewsVsAvgPoints(rawQuizzes: any[]): LabeledPoint[] {
    const quizzes = rawQuizzes.filter(
        q => q && Array.isArray(q.participantStats) && q.participantStats.length > 0
    );

    return quizzes.flatMap(q => {
        const label = q?.name?.trim?.()
            || q?.title?.trim?.()
            || q?.quizName?.trim?.()
            || q?.activityName?.trim?.()
            || `Quiz ${q?.id ?? ""}`;

        const x = typeof q?.numViews === "number"
            ? q.numViews
            : q.participantStats.reduce((acc: any, p: { numViews: any; }) => acc + (p?.numViews || 0), 0);

        const grades = q.participantStats
            .map((p: { normalizedGrade: any; }) => p?.normalizedGrade)
            .filter((g: any) => typeof g === "number");

        if (grades.length === 0) return [];

        const y = grades.reduce((a: any, b: any) => a + b, 0) / grades.length;

        return [{ x, y, label }];
    });
}

/**
 * Build scatter points for evaluable activities:
 *  - Includes quizzes, workshops and assignments.
 *  - X = total views for the activity (prefers ActivityBase.numViews).
 *  - Y = average normalized grade in [0, 10].
 *
 * NOTE:
 *  - Quizzes: use participantStats[].normalizedGrade.
 *  - Workshops/Assignments: fall back to participantStats[].grade which is already 0–10.
 */
export function buildEvaluableViewsVsAvgPoints(
    quizzes: any[],
    workshops: any[],
    assignments: any[]
): Array<{ x: number; y: number; label: string; activityType: ActivityType }> {
    const points: Array<{ x: number; y: number; label: string; activityType: ActivityType }> = [];

    const getName = (a: any, fallbackPrefix: string): string =>
        a?.name?.trim?.() ||
        a?.title?.trim?.() ||
        a?.activityName?.trim?.() ||
        `${fallbackPrefix} ${a?.id ?? ""}`;

    const getTotalViews = (a: any): number => {
        if (typeof a?.numViews === "number") return a.numViews;

        const stats = Array.isArray(a?.participantStats) ? a.participantStats : [];
        const sum = stats.reduce(
            (acc: number, p: any) =>
                acc + (typeof p?.numViews === "number" ? p.numViews : 0),
            0
        );
        return sum > 0 ? sum : 0;
    };

    const getAvgNormalizedGrade = (a: any): number | null => {
        const stats = Array.isArray(a?.participantStats) ? a.participantStats : [];
        if (stats.length === 0) return null;

        const normVals: number[] = stats
            .map((p: any) =>
                typeof p?.normalizedGrade === "number" ? p.normalizedGrade : NaN
            )
            .filter((v: number) => Number.isFinite(v));

        if (normVals.length > 0) {
            const sumNorm = normVals.reduce((s: number, v: number) => s + v, 0);
            const avgNorm = sumNorm / normVals.length;
            return Math.max(0, Math.min(10, avgNorm));
        }

        const gradesNum: number[] = stats
            .map((p: any) => (typeof p?.grade === "number" ? p.grade : NaN))
            .filter((v: number) => Number.isFinite(v));

        if (gradesNum.length === 0) return null;

        const sumGrades = gradesNum.reduce((s: number, v: number) => s + v, 0);
        const avgRaw = sumGrades / gradesNum.length;
        return Math.max(0, Math.min(10, avgRaw));
    };

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

    return points;
}

/**
 * Aggregate total Choice votes per participant.
 *
 * Returns:
 *  - A map pid -> total number of votes cast across all Choice activities.
 *
 * NOTE:
 *  - Each participantStat entry is counted as a single vote.
 */
export function buildChoiceVotesByPid(choices: any[]): Record<string, number> {
    const votesMap: Record<string, number> = {};

    for (const choice of choices) {
        const stats = Array.isArray(choice?.participantStats) ? choice.participantStats : [];
        for (const s of stats) {
            const pid = String(s.participantId);
            votesMap[pid] = (votesMap[pid] ?? 0) + 1;
        }
    }

    return votesMap;
}

