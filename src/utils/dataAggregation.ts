/**
 * @file dataAggregation.ts
 *
 * @description
 * Utility functions for aggregating Moodle activity data at participant
 * and activity level. These helpers compute:
 *  - Forum participation percentages and total forum views per participant.
 *  - Normalized average grades (0–10) for quizzes, workshops, and assignments.
 *  - Scatter data points for correlations (e.g., views vs. grades).
 *  - Total Choice votes per participant.
 *
 * These aggregations feed the correlation and predictive analysis modules,
 * providing the numerical basis for the charts in the extension.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {ActivityType} from "../models/Participant";
import {Course} from "../models/Course";

// -----------------------------------------------------------------------------
// Minimal helper types (local projections of your real domain models)
// -----------------------------------------------------------------------------

/**
 * Raw participant identifier as it may appear in forum stats.
 * It can be a string (from the DOM) or a number (already normalized).
 */
type ParticipantId = string | number;

/**
 * Minimal shape for per-participant forum statistics.
 * This is a partial view of the real ForumParticipantStats model.
 *
 * NOTE:
 * - Numeric fields are optional because some raw entries may omit them.
 * - Callers should safely coerce missing values to 0 before aggregating.
 */
type ForumStat = {
    participantId: ParticipantId;
    discussionsPosted?: number;
    repliesPosted?: number;
    views?: number;
};

/**
 * Minimal projection of a Forum with just the participant stats needed
 * for aggregation/correlation helpers.
 *
 * If you have a richer Forum model elsewhere, this type intentionally
 * only keeps the subset of fields required in this module.
 */
type Forum = {
    participantsStats?: ForumStat[];
};

// -----------------------------------------------------------------------------
// Scatter point types used by correlation charts
// -----------------------------------------------------------------------------

/**
 * Generic labeled 2D point used in scatter plots.
 * `label` is typically the participant's name, id, or any human-readable tag.
 */
export interface LabeledPoint {
    x: number;
    y: number;
    label: string;
}

/**
 * Scatter point representing an "evaluable" data item (quiz, workshop, etc.).
 * It extends LabeledPoint with the activity type so charts can
 * distinguish between different evaluable categories.
 */
export interface EvaluablePoint extends LabeledPoint {
    activityType: ActivityType;
}

/**
 * Extracts the current course object from the full `chrome.storage.local` snapshot.
 *
 * Chrome storage may contain many keys. We store courses as `course_<id>`,
 * so this helper finds the *first* matching course entry and returns it.
 *
 * @param result - Raw object returned by `chrome.storage.local.get(null)`
 * @returns The deserialized Course object, or null if none is found.
 */
export function getCurrentCourseFromStorage(result: Record<string, any>): Course | null {
    if (!result || typeof result !== "object") {
        return null;
    }

    // Find the first key with the "course_" prefix.
    const courseKey = Object.keys(result).find((key) => key.startsWith("course_"));
    if (!courseKey) {
        return null;
    }

    const rawCourse = result[courseKey];
    return rawCourse ?? null;
}

/**
 * Computes the percentage of total forum activity contributed by each participant.
 *
 * Forum activity is defined as:
 *   discussionsPosted + repliesPosted + views
 *
 * The percentage for each PID is:
 *   (participantTotal / globalTotal) * 100
 *
 * Percentages are rounded to 2 decimal places.
 *
 * @param forums - Array of forum objects holding participantsStats
 * @returns A map pid -> percentage of the overall forum activity (0–100)
 */
export function buildForumParticipationPct(forums: Forum[]): Record<string, number> {
    const perPidTotals: Record<string, number> = {};
    let globalTotal = 0;

    for (const forum of forums) {
        const stats = Array.isArray(forum?.participantsStats)
            ? forum.participantsStats
            : [];

        for (const s of stats) {
            const pid = String(s.participantId);

            // Safely accumulate all activity types (0 when missing)
            const individualTotal =
                (s.discussionsPosted ?? 0) +
                (s.repliesPosted ?? 0) +
                (s.views ?? 0);

            perPidTotals[pid] = (perPidTotals[pid] ?? 0) + individualTotal;
            globalTotal += individualTotal;
        }
    }

    // Avoid division by zero or empty result
    if (globalTotal <= 0) {
        return {};
    }

    const participationPct: Record<string, number> = {};

    for (const pid of Object.keys(perPidTotals)) {
        const pct = (perPidTotals[pid] / globalTotal) * 100;

        // Round to 2 decimals
        participationPct[pid] = Math.round(pct * 100) / 100;
    }

    return participationPct;
}

/**
 * Aggregates total forum views per participant (PID).
 *
 * For each forum's participantsStats entry:
 *   - Only `views > 0` are accumulated.
 *   - Non-numeric or missing values are treated as 0.
 *
 * @param forums - Array of forum objects that may contain participantsStats[]
 * @returns A map pid -> total views across all forums
 */
export function buildForumViewsByPid(forums: Forum[]): Record<string, number> {
    const viewsMap: Record<string, number> = {};

    for (const forum of forums) {
        const stats = Array.isArray(forum?.participantsStats)
            ? forum.participantsStats
            : [];

        for (const stat of stats) {
            const pid = String(stat.participantId);

            // Safe numeric coercion, fallback to 0
            const views = Number(stat?.views ?? 0);

            // Same logic as your original version: only accumulate if > 0
            if (Number.isFinite(views) && views > 0) {
                viewsMap[pid] = (viewsMap[pid] ?? 0) + views;
            }
        }
    }

    return viewsMap;
}

/**
 * Builds a map pid -> average normalized workshop grade (0–10).
 *
 * Each workshop may expose participant stats with raw grades that are either:
 *   - Already normalized in the 0–10 scale, or
 *   - In a 0–max scale where max comes from `maxGrade`, `gradingMax`, or `max grade`.
 *
 * This function:
 *   - Detects the workshop's maximum grade when available
 *   - Normalizes participant grades to 0–10
 *   - Ignores invalid numeric values
 *   - Averages all workshop grades per participant
 *   - Rounds the final result to 2 decimals
 *
 * @param workshops - Workshops containing participantStats and optional max grade metadata
 * @returns A map pid -> average workshop grade in the [0, 10] ranges
 */
export function buildWorkshopAvgGradeMap(workshops: any[]): Record<string, number> {
    const perPidGrades: Record<string, number[]> = {};

    /**
     * Safely converts numbers or number-like strings (including comma decimals)
     * to a proper JS number. Returns NaN on invalid inputs.
     */
    const toNumber = (v: any): number =>
        typeof v === "number"
            ? v
            : typeof v === "string"
                ? parseFloat(v.replace(",", "."))
                : NaN;

    for (const workshop of workshops ?? []) {
        const stats: any[] = Array.isArray(workshop?.participantStats)
            ? workshop.participantStats
            : [];

        // Attempt to infer the workshop's maximum grade from multiple Moodle fields
        const rawMax =
            toNumber(workshop?.maxGrade) ??
            toNumber(workshop?.gradingMax) ??
            toNumber(workshop?.maxgrade);

        // If no valid max is found, default to 10 (meaning values are already normalized)
        const maxForScale =
            Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 10;

        for (const stat of stats) {
            const pid = String(stat.participantId);
            const rawGrade = toNumber(stat?.grade);

            if (!Number.isFinite(rawGrade)) {
                continue; // skip invalid entries
            }

            // Normalize to the 0–10 scale. If already in 0–10, this does nothing.
            const normalized10 = Math.max(
                0,
                Math.min(10, (rawGrade / maxForScale) * 10)
            );

            (perPidGrades[pid] ??= []).push(normalized10);
        }
    }

    // Compute final average per pid
    const gradesMap: Record<string, number> = {};
    for (const [pid, values] of Object.entries(perPidGrades)) {
        if (values.length === 0) continue;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        gradesMap[pid] = Math.round(avg * 100) / 100; // round to 2 decimals
    }

    return gradesMap;
}

/**
 * Builds a map pid -> average normalized quiz grade (0–10).
 *
 * For each quiz:
 *   - Reads `participantStats[].normalizedGrade`
 *   - Accepts both numeric values and string values with comma/point decimals
 *   - Invalid or missing grades are ignored
 *   - Each participant's grades are averaged and rounded to 2 decimals
 *
 * @param quizzes - Array of quiz objects with participantStats
 * @returns pid -> average normalized grade in the 0–10 scale
 */
export function buildQuizAvgGradeMap(quizzes: any[]): Record<string, number> {
    const perPidGrades: Record<string, number[]> = {};

    /**
     * Coerces a value to a number, supporting comma decimal separators.
     * Returns NaN when conversion fails.
     */
    const toNumber = (v: any): number =>
        typeof v === "number"
            ? v
            : typeof v === "string"
                ? parseFloat(v.replace(",", "."))
                : NaN;

    for (const quiz of quizzes) {
        const stats: any[] = Array.isArray(quiz?.participantStats)
            ? quiz.participantStats
            : [];

        for (const stat of stats) {
            const pid = String(stat.participantId);
            const g10 = toNumber(stat.normalizedGrade);

            // Only accumulate valid numbers
            if (Number.isFinite(g10)) {
                // Ensure the grade stays within the 0–10 range
                const clamped = Math.max(0, Math.min(10, g10));
                (perPidGrades[pid] ??= []).push(clamped);
            }
        }
    }

    // Build final averaged map
    const gradesMap: Record<string, number> = {};
    for (const pid of Object.keys(perPidGrades)) {
        const grades = perPidGrades[pid];
        if (grades.length === 0) continue;

        const avg = grades.reduce((acc, g) => acc + g, 0) / grades.length;
        gradesMap[pid] = Math.round(avg * 100) / 100; // round to 2 decimals
    }

    return gradesMap;
}

/**
 * Builds scatter points for the correlation:
 *   X = total quiz views
 *   Y = average normalized quiz grade (0–10)
 *
 * For each quiz:
 *   - The label is inferred from several name-like fields, falling back to `Quiz <id>`.
 *   - Total views (X) come from:
 *       - `quiz.numViews` when present, or
 *       - the sum of `participantStats[].numViews` otherwise.
 *   - The average grade (Y) is computed from `participantStats[].normalizedGrade`
 *     considering only numeric values.
 *
 * @param rawQuizzes - Array of quiz-like objects with participantStats
 * @returns An array of labeled points, one per quiz with valid grades
 */
export function buildQuizViewsVsAvgPoints(rawQuizzes: any[]): LabeledPoint[] {
    // Keep only quizzes that actually have participant stats
    const quizzes = rawQuizzes.filter(
        (q) => q && Array.isArray(q.participantStats) && q.participantStats.length > 0
    );

    return quizzes.flatMap((quiz) => {
        // Try to build a human-friendly label from several possible fields
        const label =
            quiz?.name?.trim?.() ||
            quiz?.title?.trim?.() ||
            quiz?.quizName?.trim?.() ||
            quiz?.activityName?.trim?.() ||
            `Quiz ${quiz?.id ?? ""}`;

        // X: total views for this quiz
        const totalViews =
            typeof quiz?.numViews === "number"
                ? quiz.numViews
                : quiz.participantStats.reduce(
                    (acc: number, p: { numViews?: number }) => acc + (p?.numViews || 0),
                    0
                );

        // Collect numeric normalized grades
        const grades = quiz.participantStats
            .map((p: { normalizedGrade: any }) => p?.normalizedGrade)
            .filter((g: any) => typeof g === "number");

        // If there are no numeric grades, we don't emit a point for this quiz
        if (grades.length === 0) {
            return [];
        }

        const avgGrade =
            grades.reduce((sum: number, g: number) => sum + g, 0) / grades.length;

        // One point per quiz: (total views, average normalized grade)
        return [
            {
                x: totalViews,
                y: avgGrade,
                label,
            },
        ];
    });
}

/**
 * Aggregates the total number of Choice votes per participant (PID).
 *
 * Each entry in `participantStats[]` represents exactly **one vote** made by
 * the participant, regardless of whether the choice includes multiple options
 * or additional metadata.
 *
 * Returns a map:
 *   pid -> number of votes cast across all Choice activities
 *
 * @param choices - Array of choice-like objects with participantStats
 * @returns Record<string, number> mapping each PID to its total vote count
 */
export function buildChoiceVotesByPid(choices: any[]): Record<string, number> {
    const votesMap: Record<string, number> = {};

    for (const choice of choices) {
        const stats = Array.isArray(choice?.participantStats)
            ? choice.participantStats
            : [];

        for (const stat of stats) {
            const pid = String(stat.participantId);
            votesMap[pid] = (votesMap[pid] ?? 0) + 1; // 1 vote per stat entry
        }
    }

    return votesMap;
}

/**
 * Build scatter points for evaluable activities:
 *  - Includes quizzes, workshops, and assignments.
 *  - X = total views for the activity (prefers ActivityBase.numViews).
 *  - Y = average normalized grade in [0, 10].
 *
 * NOTE:
 *  - Quizzes: use participantStats[].normalizedGrade when present.
 *  - Workshops/Assignments: fall back to participantStats[].grade,
 *    assuming it is already in the 0–10 scale.
 *
 * @param quizzes - Quiz-like objects with participantStats and optional numViews
 * @param workshops - Workshop-like objects with participantStats and optional numViews
 * @param assignments - Assignment-like objects with participantStats and optional numViews
 * @returns Array of scatter points with label + activityType, one point per activity
 */
export function buildEvaluableViewsVsAvgPoints(
    quizzes: any[],
    workshops: any[],
    assignments: any[]
): Array<{ x: number; y: number; label: string; activityType: ActivityType }> {
    const points: Array<{ x: number; y: number; label: string; activityType: ActivityType }> = [];

    /**
     * Derives a human-friendly activity name from multiple possible fields.
     * Falls back to a generic prefix with the activity id when needed.
     */
    const getName = (activity: any, fallbackPrefix: string): string =>
        activity?.name?.trim?.() ||
        activity?.title?.trim?.() ||
        activity?.activityName?.trim?.() ||
        `${fallbackPrefix} ${activity?.id ?? ""}`;

    /**
     * Computes the total number of views for a given activity.
     *
     * Prefers:
     *   - activity.numViews when it is a number.
     * Otherwise:
     *   - Sums participantStats[].numViews (only numeric values).
     */
    const getTotalViews = (activity: any): number => {
        if (typeof activity?.numViews === "number") {
            return activity.numViews;
        }

        const stats = Array.isArray(activity?.participantStats)
            ? activity.participantStats
            : [];

        const sum = stats.reduce(
            (acc: number, p: any) =>
                acc + (typeof p?.numViews === "number" ? p.numViews : 0),
            0
        );

        // Ensure we never return a negative number
        return sum > 0 ? sum : 0;
    };

    /**
     * Computes the average normalized grade for an activity in the [0, 10] ranges.
     *
     * Priority:
     *   1) Use participantStats[].normalizedGrade when there are valid numeric values.
     *   2) Otherwise, fall back to participantStats[].grade (assumed already 0–10).
     *
     * Returns:
     *   - A number in [0, 10] when data is available.
     *   - null when no valid grades can be computed.
     */
    const getAvgNormalizedGrade = (activity: any): number | null => {
        const stats = Array.isArray(activity?.participantStats)
            ? activity.participantStats
            : [];

        if (stats.length === 0) return null;

        // First attempt: use normalizedGrade values
        const normVals: number[] = stats
            .map((p: any) =>
                typeof p?.normalizedGrade === "number" ? p.normalizedGrade : NaN
            )
            .filter((v: number) => Number.isFinite(v));

        if (normVals.length > 0) {
            const sumNorm = normVals.reduce((sum: number, v: number) => sum + v, 0);
            const avgNorm = sumNorm / normVals.length;
            // Clamp to [0, 10] to avoid out-of-range artifacts
            return Math.max(0, Math.min(10, avgNorm));
        }

        // Fallback: use grade values (assumed already normalized to 0–10)
        const gradesNum: number[] = stats
            .map((p: any) => (typeof p?.grade === "number" ? p.grade : NaN))
            .filter((v: number) => Number.isFinite(v));

        if (gradesNum.length === 0) return null;

        const sumGrades = gradesNum.reduce((sum: number, v: number) => sum + v, 0);
        const avgRaw = sumGrades / gradesNum.length;
        return Math.max(0, Math.min(10, avgRaw));
    };

    // -------------------------------------------------------------------------
    // Quizzes
    // -------------------------------------------------------------------------
    for (const quiz of quizzes) {
        const y = getAvgNormalizedGrade(quiz);
        if (y == null) continue; // keep loose equality to catch null/undefined

        const x = getTotalViews(quiz);
        points.push({
            x,
            y,
            label: getName(quiz, "Quiz"),
            activityType: ActivityType.Quiz,
        });
    }

    // -------------------------------------------------------------------------
    // Workshops
    // -------------------------------------------------------------------------
    for (const workshop of workshops) {
        const y = getAvgNormalizedGrade(workshop);
        if (y == null) continue;

        const x = getTotalViews(workshop);
        points.push({
            x,
            y,
            label: getName(workshop, "Workshop"),
            activityType: ActivityType.Workshop,
        });
    }

    // -------------------------------------------------------------------------
    // Assignments
    // -------------------------------------------------------------------------
    for (const assignment of assignments) {
        const y = getAvgNormalizedGrade(assignment);
        if (y == null) continue;

        const x = getTotalViews(assignment);
        points.push({
            x,
            y,
            label: getName(assignment, "Assignment"),
            activityType: ActivityType.Assignment,
        });
    }

    return points;
}