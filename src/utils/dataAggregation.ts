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

// Calcula pid -> nota media en talleres (normalizada a 0–10, con robustez)
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


