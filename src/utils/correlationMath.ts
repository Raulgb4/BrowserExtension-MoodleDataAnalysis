/**
 * @file correlationMath.ts
 *
 * @description
 * Utility module providing mathematical and statistical helpers used by
 * the correlation analysis components of the Moodle Data Analyzer extension.
 *
 * It includes numeric parsing utilities, least-squares linear regression
 * (for computing slope, intercept, correlation coefficient, and R²),
 * dynamic X-axis bound calculation for percentage-based charts, and
 * correlation classification helpers for localized textual descriptions.
 *
 * Designed for reuse across multiple predictive analytics tabs such as
 * correlations between forum participation, quiz grades, assignments, and
 * other learning activity indicators.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

// --- Types -------------------------------------------------------------------

import {Participant} from "../models/Participant";

/** Minimal XY point used in correlation helpers. */
export interface XYPoint {
    x: number;
    y: number;
}

// --- Numeric helpers ---------------------------------------------------------

/**
 * Parses numbers that may arrive as "7,5" or "7.5".
 * Returns NaN if it cannot parse.
 */
export function toNumber(v: unknown): number {
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseFloat(v.replace(",", "."));
    return NaN;
}

/** Safe average; returns NaN for empty arrays. */
export function average(arr: number[]): number {
    if (!arr.length) return NaN;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
}

// --- Linear regression (least squares) ---------------------------------------

/**
 * Ordinary Least Squares for y = a + b*x.
 * Returns intercept (a), slope (b), Pearson correlation (r), and r^2.
 * For < 2 points, returns zeros to keep render logic simple.
 */
export function leastSquares(pts: XYPoint[]) {
    const n = pts.length;
    if (n < 2) return { a: 0, b: 0, r: 0, r2: 0 };

    let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
        const { x, y } = pts[i];
        sx += x; sy += y;
        sxy += x * y;
        sxx += x * x;
        syy += y * y;
    }

    const cov  = sxy - (sx * sy) / n;
    const varx = sxx - (sx * sx) / n;
    const vary = syy - (sy * sy) / n;

    const b = varx === 0 ? 0 : cov / varx;
    const a = sy / n - b * (sx / n);
    const r = (varx === 0 || vary === 0) ? 0 : cov / Math.sqrt(varx * vary);

    return { a, b, r, r2: r * r };
}

/**
 * Convenience helper: computes y on the regression line y = a + b*x.
 * Useful when drawing the trend line.
 */
export function regressionY(a: number, b: number, x: number): number {
    return a + b * x;
}

// --- Axis helpers ------------------------------------------------------------

/**
 * Computes a "nice" X-axis domain and tick step for percentage-like data (0..maxPercent).
 * Keeps labels tidy as data scales.
 *
 * @param points Points to inspect for max X.
 * @param maxPercent Hard upper limit (default 100).
 */
export function computeXAxisBounds(
    points: Array<{ x: number }>,
    maxPercent = 100
): { min: number; max: number; stepSize: number } {
    if (!points.length) return { min: 0, max: 10, stepSize: 2 };

    let maxX = 0;
    for (let i = 0; i < points.length; i++) {
        if (points[i].x > maxX) maxX = points[i].x;
    }

    // Small padding to avoid clipping the last points/line.
    const pad = Math.max(0.5, maxX * 0.10);
    const rawUpper = Math.min(maxPercent, maxX + pad);

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

    return { min: 0, max: upperBound, stepSize };
}

export function buildCorrelationPoints(
    metricX: Record<string, number>,
    metricY: Record<string, number>,
    participantsById: Map<string, Participant>
): Array<{ pid: string; x: number; y: number }> {
    const rows = [];
    for (const pid in metricX) {
        const x = metricX[pid];
        const y = metricY[pid];
        if (x == null || y == null) continue;
        if (!participantsById.get(pid)) continue;
        rows.push({ pid, x, y });
    }
    return rows;
}

// --- Correlation classification (for i18n keys) -----------------------------

/**
 * Returns i18n keys for correlation strength and direction based on r.
 * Keep the mapping here so UI stays clean.
 */
export function classifyCorrelation(r: number): { strengthKey: string; directionKey: string } {
    const rAbs = Math.abs(r);
    const strengthKey =
        rAbs < 0.10 ? "note.corr.none" :
            rAbs < 0.20 ? "note.corr.very_weak" :
                rAbs < 0.40 ? "note.corr.weak" :
                    rAbs < 0.60 ? "note.corr.moderate" :
                        rAbs < 0.80 ? "note.corr.strong" :
                            "note.corr.very_strong";

    const directionKey = r >= 0 ? "note.corr.positive" : "note.corr.negative";
    return { strengthKey, directionKey };
}
