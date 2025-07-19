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

import { ChartData } from "chart.js";
import {Quiz} from "../models/Quiz";

export const calculateAvgViews = (views: number[], users: number[]): number[] =>
    views.map((v, i) =>
        users[i] !== 0 ? parseFloat((v / users[i]).toFixed(2)) : 0
    );

export const calculateDaysSince = (timestamps: number[]): number[] =>
    timestamps.map(ts =>
        ts ? Math.floor(ts / (1000 * 60 * 60 * 24)) : 0
    );

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

export const extractUniqueRoles = (participants: any[]): string[] => {
    const roles = new Set<string>();
    participants.forEach(p => {
        if (Array.isArray(p.roles)) {
            p.roles.forEach((role: string) => roles.add(role));
        }
    });
    return Array.from(roles);
};

export const filterByRoles = (participants: any[], selectedRoles: string[]): any[] =>
    participants.filter(p =>
        p.roles?.some((r: string) => selectedRoles.includes(r))
    );

export const computeActiveInactive = (participants: any[]): { active: number; inactive: number } => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    let active = 0;
    let inactive = 0;

    for (const p of participants) {
        const lastAccess = p.lastAccessToCourse;
        const daysAgo = lastAccess !== undefined ? Math.floor(lastAccess / MS_PER_DAY) : null;
        if (daysAgo === null || daysAgo > 7) inactive++;
        else active++;
    }

    return { active, inactive };
};

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

export const calculateAvgNormalizedScores = (quizzes: Quiz[]): number[] =>
    quizzes.map(quiz => {
        const total = quiz.participantStats.reduce(
            (sum, p) => sum + p.normalizedGrade,
            0
        );
        const avg = total / quiz.participantStats.length;
        return parseFloat(avg.toFixed(2));
    });

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