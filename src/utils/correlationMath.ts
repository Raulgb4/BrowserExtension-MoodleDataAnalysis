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

/**
 * Minimal XY point used in correlation helpers.
 * Represents a single observation for regression/correlation analysis.
 */
export interface XYPoint {
    x: number;
    y: number;
}

/**
 * Result of a simple linear regression y = a + b*x.
 *
 * - a: intercept
 * - b: slope
 * - r: Pearson correlation coefficient in [-1, 1]
 * - r2: coefficient of determination in [0, 1]
 */
export interface LinearRegressionResult {
    a: number;
    b: number;
    r: number;
    r2: number;
}

/**
 * Axis configuration object returned by computeDynamicXAxis.
 * Mirrors the structure used across correlation axis helpers.
 */
export interface DynamicAxisConfig {
    min: number;
    max: number;
    stepSize: number;
}

/**
 * Axis configuration for correlation charts.
 * Designed to be passed directly into chart scale options.
 */
export interface CorrelationAxisConfig {
    min: number;
    max: number;
    stepSize: number;
}

/**
 * i18n label keys describing the qualitative correlation.
 * The actual translation is the responsibility of the caller (UI layer).
 */
export interface CorrelationLabels {
    strengthKey: string;
    directionKey: string;
}

/**
 * Aggregated correlation statistics for a given set of (x, y) points.
 *
 * - axis: suggested X-axis configuration (percentage-based in this helper).
 * - regression: linear regression parameters and correlation coefficients.
 * - labels: qualitative description via i18n keys.
 */
export interface CorrelationStats {
    axis: CorrelationAxisConfig;
    regression: LinearRegressionResult; // from leastSquares(...)
    labels: CorrelationLabels;
}

// --- Linear regression (least squares) ---------------------------------------

/**
 * Ordinary Least Squares for the linear model: y = a + b*x.
 *
 * It computes:
 *  - intercept (a)
 *  - slope (b)
 *  - Pearson correlation (r)
 *  - coefficient of determination (r²)
 *
 * Edge cases:
 *  - For fewer than 2 points, returns zeros to keep render logic simple.
 *  - If variance in X or Y is zero, r and/or b are set to 0 to avoid NaNs.
 */
export function leastSquares(pts: XYPoint[]): LinearRegressionResult {
    const n = pts.length;
    if (n < 2) {
        return {a: 0, b: 0, r: 0, r2: 0};
    }

    let sx = 0;
    let sy = 0;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;

    for (let i = 0; i < n; i++) {
        const {x, y} = pts[i];
        sx += x;
        sy += y;
        sxy += x * y;
        sxx += x * x;
        syy += y * y;
    }

    // Covariance and variances (using sum-based formulation)
    const cov = sxy - (sx * sy) / n;
    const varx = sxx - (sx * sx) / n;
    const vary = syy - (sy * sy) / n;

    const b = varx === 0 ? 0 : cov / varx;
    const meanX = sx / n;
    const meanY = sy / n;
    const a = meanY - b * meanX;

    const r =
        varx === 0 || vary === 0
            ? 0
            : cov / Math.sqrt(varx * vary);

    return {a, b, r, r2: r * r};
}

/**
 * Convenience helper: computes y on the regression line y = a + b*x.
 * Useful when drawing the trend line over a scatter plot.
 */
export function regressionY(a: number, b: number, x: number): number {
    return a + b * x;
}

// --- Axis helpers ------------------------------------------------------------

/**
 * Computes a "nice" X-axis domain and tick step for percentage-like data (0...maxPercent).
 *
 * Behavior summary:
 *  - Inspects the maximum X among the data points.
 *  - Applies a small padding so the chart does not clip the last point/regression line.
 *  - Caps the domain at `maxPercent` (default: 100).
 *  - Chooses a tick step (1, 2, 5, or 10) depending on the final domain size.
 *
 * This helper is intentionally conservative: it only adjusts the *upper bound* and
 * always forces the lower bound to 0, since percentage-based charts typically start there.
 *
 * @param points Array of points { x: number } to inspect.
 * @param maxPercent Hard upper limit for the percentage domain (default: 100).
 * @returns { min, max, stepSize } — parameters appropriate for configuring Chart.js scales.
 */
export function computeXAxisBounds(
    points: Array<{ x: number }>,
    maxPercent = 100
): { min: number; max: number; stepSize: number } {
    // No points → fallback domain
    if (points.length === 0) {
        return {min: 0, max: 10, stepSize: 2};
    }

    // Compute max X efficiently
    let maxX = 0;
    for (let i = 0; i < points.length; i++) {
        const value = points[i].x;
        if (value > maxX) {
            maxX = value;
        }
    }

    // Small padding to avoid clipping the last points / regression line
    const pad = Math.max(0.5, maxX * 0.10);
    const rawUpper = Math.min(maxPercent, maxX + pad);

    /**
     * Rounds a number up to the nearest multiple of `step`.
     * Used to keep upper bounds "chart-friendly".
     */
    const roundUp = (n: number, step: number) =>
        Math.ceil(n / step) * step;

    // Choose a suitable “nice” upper bound
    const upperBound =
        rawUpper <= 10 ? roundUp(rawUpper, 1) :
            rawUpper <= 20 ? roundUp(rawUpper, 2) :
                rawUpper <= 50 ? roundUp(rawUpper, 5) :
                    roundUp(rawUpper, 10);

    // And the corresponding tick step
    const stepSize =
        upperBound <= 10 ? 1 :
            upperBound <= 20 ? 2 :
                upperBound <= 50 ? 5 : 10;

    return {min: 0, max: upperBound, stepSize};
}

/**
 * Compute a padded X-axis range and a reasonable tick step
 * for scatter plots where X is an unbounded numeric measure
 * (e.g., total views, attempts, interactions, etc.).
 *
 * Behavior:
 *  - Extracts min/max of the X values.
 *  - Adds ~5% padding so that points and regression lines
 *    do not touch the chart borders.
 *  - Ensures min never falls below 0 (common in count-based metrics).
 *  - Chooses a tick step that yields ~5–6 ticks for readability.
 *
 * Notes:
 *  - This helper is domain-agnostic: any unbounded metric can be used.
 *  - Padding uses a minimum of 1 to avoid degenerate axes when all X are equal.
 */
export function computeDynamicXAxis(
    points: Array<{ x: number; y: number }>
): DynamicAxisConfig {

    // Empty or falsy input → fallback axis
    if (!points || points.length === 0) {
        return {min: 0, max: 1, stepSize: 1};
    }

    // Extract X values efficiently
    const xs = points.map((p) => p.x);
    const rawMin = Math.min(...xs);
    const rawMax = Math.max(...xs);

    // 5% padding (rounded) with a minimum of 1
    const pad = Math.max(1, Math.round((rawMax - rawMin) * 0.05));

    // Protect lower bound → do not allow negative X axis (counts are non-negative)
    const min = Math.max(0, rawMin - pad);
    const max = rawMax + pad;

    // Aim for ~6 ticks: choose a safe integer step
    const span = max - min;
    const stepSize = Math.max(1, Math.round(span / 6));

    return {min, max, stepSize};
}

/**
 * Builds a list of correlation-ready points by pairing X and Y metrics
 * for participants present in both metric dictionaries.
 *
 * Behavior:
 *  - Only includes participants for which BOTH metricX[pid] and metricY[pid] exist.
 *  - Ignores null/undefined values.
 *  - Ensures the PID exists in `participantsById` (avoids orphan metric entries).
 *  - Returns an array of { pid, x, y } sorted in the same order as metricX iteration.
 *
 * Notes:
 *  - This helper does NOT validate numeric ranges or clamp values.
 *  - It assumes the caller already preprocessed the metrics (e.g., normalized grades).
 */
export function buildCorrelationPoints(
    metricX: Record<string, number>,
    metricY: Record<string, number>,
    participantsById: Map<string, Participant>
): Array<{ pid: string; x: number; y: number }> {

    const result: Array<{ pid: string; x: number; y: number }> = [];

    // Iterate over keys of metricX as the “driver.”
    for (const pid in metricX) {
        if (!Object.prototype.hasOwnProperty.call(metricX, pid)) continue;

        const x = metricX[pid];
        const y = metricY[pid];

        // Require both metrics to exist
        if (x == null || y == null) continue;

        // PID must correspond to a real participant
        if (!participantsById.has(pid)) continue;

        result.push({pid, x, y});
    }

    return result;
}

// --- Correlation classification (for i18n keys) -----------------------------

/**
 * Maps a Pearson correlation coefficient (r) to qualitative i18n keys.
 *
 * Behavior:
 *  - Uses the absolute value |r| to determine correlation *strength*.
 *  - Uses the sign of r to determine correlation *direction*.
 *  - Thresholds follow a common interpretation:
 *      0.00–0.10 → none
 *      0.10–0.20 → very weak
 *      0.20–0.40 → weak
 *      0.40–0.60 → moderate
 *      0.60–0.80 → strong
 *      0.80–1.00 → very strong
 *
 * Output:
 *  - strengthKey: e.g., "note.corr.moderate"
 *  - directionKey: "note.corr.positive" | "note.corr.negative"
 *
 * This function does not clamp r; it assumes the caller passes a valid
 * Pearson correlation in [-1, 1].
 */
export function classifyCorrelation(
    r: number
): { strengthKey: string; directionKey: string } {

    const rAbs = Math.abs(r);

    // Qualitative strength thresholds based on |r|
    const strengthKey =
        rAbs < 0.10 ? "note.corr.none" :
            rAbs < 0.20 ? "note.corr.very_weak" :
                rAbs < 0.40 ? "note.corr.weak" :
                    rAbs < 0.60 ? "note.corr.moderate" :
                        rAbs < 0.80 ? "note.corr.strong" :
                            "note.corr.very_strong";

    // Direction purely from the sign
    const directionKey =
        r >= 0 ? "note.corr.positive" : "note.corr.negative";

    return {strengthKey, directionKey};
}

/**
 * Compute all derived correlation metrics for a given set of (x, y) points.
 *
 * This helper is intentionally UI-agnostic: it only deals with numeric results
 * and i18n keys. The caller is responsible for:
 *  - Applying translations.
 *  - Wiring the axis config into the chart library (e.g., Chart.js scales).
 *  - Deciding how/where to render the qualitative summary.
 *
 * Note:
 *  - Uses `computeXAxisBounds(points, 100)` so the X-axis is treated as a
 *    percentage scale between 0 and 100.
 */
export function buildCorrelationStats(points: XYPoint[]): CorrelationStats {
    const {min, max, stepSize} = computeXAxisBounds(points, 100);
    const {a, b, r, r2} = leastSquares(points);
    const {strengthKey, directionKey} = classifyCorrelation(r);

    return {
        axis: {min, max, stepSize},
        regression: {a, b, r, r2},
        labels: {strengthKey, directionKey},
    };
}