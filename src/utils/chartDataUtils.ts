/**
 * @file chartDataUtils.ts
 *
 * @description
 * Utility functions for preparing and transforming chart data used across the extension.
 * Includes reusable helpers for:
 * - Calculating average views per user
 * - Calculating days since last access from timestamps
 * - Structuring dataset objects for Chart.js rendering
 *
 * These functions help keep chart-related code DRY and more readable in components like GlobalTab.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {ChartData} from "chart.js";
import {Quiz} from "../models/Quiz";

/**
 * Calculates the average number of views per user for each activity.
 *
 * @param views - Array of total views for each activity type.
 * @param users - Array of total users for each activity type.
 * @returns An array with average views per user, rounded to two decimal places.
 */
export const calculateAvgViews = (views: number[], users: number[]): number[] =>
    views.map((v, i) =>
        users[i] !== 0 ? parseFloat((v / users[i]).toFixed(2)) : 0
    );

/**
 * Creates a Chart.js-compatible bar chart dataset with custom colors and optional configuration.
 *
 * @param labels - The labels for the x-axis (e.g., activity names).
 * @param label - The label for the dataset (e.g. "Visits").
 * @param data - The numeric values corresponding to each label.
 * @param color - An object with `bg` (backgroundColor) and `border` (borderColor).
 * @param config - Optional. Additional configuration to merge into the dataset (e.g. `tension`, `fill`).
 * @returns A `ChartData<'bar'>` object ready for rendering with Chart.js.
 */
export const createChartData = (
    labels: string[],
    label: string,
    data: number[],
    color: { bg: string; border: string },
    config?: Record<string, any>
): ChartData<'bar'> => ({
    labels,
    datasets: [
        {
            label,
            data,
            backgroundColor: color.bg,
            borderColor: color.border,
            borderWidth: 1,
            ...config,
        },
    ],
});

/**
 * Extracts all unique role names from a list of participants.
 *
 * @param participants - Array of participant objects, each potentially containing a `roles` array.
 * @returns An array of unique role names present in the input list.
 */
export const extractUniqueRoles = (participants: any[]): string[] => {
    const roles = new Set<string>();
    participants.forEach(p => {
        if (Array.isArray(p.roles)) {
            p.roles.forEach((role: string) => roles.add(role));
        }
    });
    return Array.from(roles);
};


/**
 * Filters a list of participants based on selected roles.
 *
 * @param participants - The full list of course participants.
 * @param selectedRoles - The roles that should be included in the filter.
 * @returns A filtered array containing only participants with matching roles.
 */
export const filterByRoles = (participants: any[], selectedRoles: string[]): any[] =>
    participants.filter(p =>
        p.roles?.some((r: string) => selectedRoles.includes(r))
    );

/**
 * Computes the number of active and inactive participants based on their last access date.
 *
 * @param participants - Array of participants with an optional `lastAccessToCourse` timestamp.
 * @returns An object containing counts of `active` (last access ≤ 7 days) and `inactive` participants.
 */
type HasLastAccess = { lastAccessToCourse?: number | null };

export const computeActiveInactive = (
    participants: HasLastAccess[],
    thresholdDays = 14
): { active: number; inactive: number } => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const THRESHOLD_MS = thresholdDays * MS_PER_DAY;

    let active = 0;
    let inactive = 0;

    for (const p of participants) {
        const ms = p.lastAccessToCourse;

        // Inactive if missing, non-finite, <= 0, or beyond threshold
        if (ms == null || !Number.isFinite(ms) || ms <= 0 || ms > THRESHOLD_MS) {
            inactive++;
        } else {
            active++;
        }
    }

    return {active, inactive};
};

/**
 * Categorizes participants into time-based ranges according to their last access date.
 *
 * @param participants - Array of participants with an optional `lastAccessToCourse` timestamp.
 * @returns An array of five numbers corresponding to these access ranges:
 *          [Last 7 days, 8–30 days, 31–90 days, > 90 days, Never accessed]
 */
export const computeAccessRanges = (participants: any[]): number[] => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const ranges = {
        "Last 7 days": 0,
        "8-30 days": 0,
        "31-90 days": 0,
        "> 90 days": 0,
        "Never accessed": 0,
    };

    for (const p of participants) {
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

    return Object.values(ranges);
};

/**
 * Calculates the average normalized score for each quiz.
 *
 * @param quizzes - Array of `Quiz` objects, each containing participant statistics.
 * @returns An array of average normalized scores, rounded to two decimal places, one per quiz.
 */
export const calculateAvgNormalizedScores = (quizzes: Quiz[]): number[] =>
    quizzes.map(quiz => {
        const total = quiz.participantStats.reduce(
            (sum, p) => sum + p.normalizedGrade,
            0
        );
        const avg = total / quiz.participantStats.length;
        return parseFloat(avg.toFixed(2));
    });

/**
 * Retrieves the top N items from a dataset based on a numeric metric.
 *
 * @typeParam T - The type of elements in the dataset.
 * @param items - Array of items to evaluate.
 * @param topN - The number of top items to return.
 * @param valueSelector - Function to extract the numeric metric from each item.
 * @param labelSelector - Function to extract the label for each item.
 * @returns An object containing `labels` and `values` arrays, corresponding to the top N items.
 */
export function getTopByMetric<T>(
    items: T[],
    topN: number,
    valueSelector: (item: T) => number,
    labelSelector: (item: T) => string
): { labels: string[]; values: number[] } {
    const sorted = [...items].sort((a, b) => valueSelector(b) - valueSelector(a));
    const top = sorted.slice(0, topN);

    return {
        labels: top.map(labelSelector),
        values: top.map(valueSelector),
    };
}