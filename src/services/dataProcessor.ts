/**
 * @file dataProcessor.ts
 * @description
 * Utility functions for processing and normalizing raw data extracted from Moodle pages.
 * Includes conversion of time strings to milliseconds, grade normalization, and other
 * data cleaning operations to prepare information for structured analysis or export.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

/**
 * Converts Moodle duration strings or absolute date strings to milliseconds.
 *
 * Examples of accepted inputs:
 * - "5 days 13 hours"
 * - "46 mins 32 secs"
 * - "Tuesday, 18 October 2022, 6:49 PM"
 * - "Saturday, 14 January 2023, 1:09 AM"
 *
 * @param input - The raw string from Moodle
 * @returns The total duration or date in milliseconds, or undefined if input is "Never"
 */
export function normalizeTimeToMillis(input: string): number | undefined {
    if (!input) return undefined;

    const s = input.replace(/\u00A0/g, " ").trim().toLowerCase();
    if (!s || s === "-" || /^(never|nunca)$/.test(s)) return undefined;
    if (/^(now|ahora)$/.test(s)) return 0;

    // ¿Contiene una fecha dd/mm/yy(yy)? Si sí, NO interpretamos "13:27" como duración.
    const hasDateLike = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(s);

    // 1) Sumar tokens con unidades ES/EN (agnóstico al orden y mezclas)
    //    years/años, days/días/d, hours/horas/h, minutes/minutos/min/m, seconds/segundos/seg/s
    let years = 0, days = 0, hours = 0, mins = 0, secs = 0;

    const add = (re: RegExp, target: (n: number) => void) => {
        const g = s.matchAll(re);
        for (const m of g) {
            const n = parseInt(m[1], 10);
            if (Number.isFinite(n)) target(n);
        }
    };

    add(/(\d+)\s*(?:years?|a\u00f1os?)/g, n => years += n);
    add(/(\d+)\s*(?:d(?:\u00edas?)?|days?|d\b)/g, n => days += n);
    add(/(\d+)\s*(?:h(?:oras?)?|hours?|hrs?)/g, n => hours += n);
    add(/(\d+)\s*(?:m(?:in(?:utos?)?)?|minutes?|mins?|\bm\b)/g, n => mins += n);
    add(/(\d+)\s*(?:s(?:eg(?:undos?)?)?|seconds?|secs?|\bs\b)/g, n => secs += n);

    const hasUnitTokens = (years + days + hours + mins + secs) > 0;

    if (hasUnitTokens) {
        return ((((years * 365 + days) * 24 + hours) * 60 + mins) * 60 + secs) * 1000;
    }

    // 2) Formato con dos puntos (HH:MM:SS o MM:SS) solo si NO parece fecha
    if (!hasDateLike) {
        const colon = s.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
        if (colon) {
            const hasH = colon[3] !== undefined;
            const h = hasH ? parseInt(colon[1], 10) : 0;
            const m = hasH ? parseInt(colon[2], 10) : parseInt(colon[1], 10);
            const sec = hasH ? parseInt(colon[3]!, 10) : parseInt(colon[2], 10);
            return ((h * 3600) + (m * 60) + sec) * 1000;
        }
    }

    // 3) Último recurso: si la cadena es SOLO fecha/hora y el runtime la entiende, devolvemos ms absoluto
    const ts = Date.parse(s);
    return Number.isFinite(ts) ? ts : undefined;
}

/**
 * Converts a grade to a normalized value over 10.
 * If maxGrade is 0, returns 0 to avoid division by zero.
 *
 * @param grade The original grade obtained by the participant.
 * @param maxGrade The maximum possible grade for the quiz.
 * @returns The grade normalized to a scale of 0 to 10.
 */
export function normalizeGradeTo10(grade: number, maxGrade: number): number {
    if (maxGrade === 0) return 0;
    return parseFloat(((grade / maxGrade) * 10).toFixed(2));
}

/**
 * Converts a raw role string (e.g., "Teacher, Manager") into an array of role names.
 * Returns undefined if the string is empty, "-", or indicates no roles.
 *
 * @param raw - The raw string containing role names, typically comma-separated.
 * @returns An array of trimmed role names, or undefined if the input is invalid or empty.
 */
export function parseRoles(raw: string | undefined): string[] | undefined {
    if (!raw || raw.trim() === '-' || raw.toLowerCase().includes('no roles')) return undefined;
    return raw.split(',').map(r => r.trim());
}

/**
 * Converts a raw group string (e.g., "Group A, Group B") into an array of group names.
 * Returns undefined if the string is empty, "-", or indicates no groups.
 *
 * @param raw - The raw string containing group names, typically comma-separated.
 * @returns An array of trimmed group names, or undefined if the input is invalid or empty.
 */

/*
export function parseGroups(raw: string | undefined): string[] | undefined {
    if (!raw || raw.trim() === '-' || raw.toLowerCase().includes('no groups')) return undefined;
    return raw.split(',').map(g => g.trim());
}
 */

/**
 * Parses the Moodle "last access" cell into a relative duration in milliseconds.
 *
 * Expected inputs include UMA-style two-line cells (e.g., first line: "1 year 230 d",
 * second line: "22/12/23 19:32"). This function:
 *   1) Keeps only the first line (the relative fragment).
 *   2) Normalizes abbreviations to what `normalizeTimeToMillis` expects:
 *      - `d` -> `days`
 *      - `h` -> `hours`
 *      - `min`-> `mins`
 *      - `s` / `sec` -> `secs`
 *   3) Returns `undefined` for "never", "-", or empty input.
 *
 * Note: If the first line were an absolute date string, `normalizeTimeToMillis`
 * can parse it via `Date.parse`, but UMA typically puts an absolute date on the
 * second line which is intentionally ignored here.
 *
 * @param raw Raw "last access" text from the table cell (may contain line breaks).
 * @returns Relative duration in milliseconds, or `undefined` when not applicable.
 */
export function parseLastAccess(raw: string | undefined): number | undefined {
    if (!raw) return undefined;
    const cleaned = raw.replace(/\u00A0/g, " ").trim();
    if (!cleaned) return undefined;

    // Prioriza lo que hay entre paréntesis si existe
    const paren = cleaned.match(/\(([^)]+)\)/);
    const chunk = (paren ? paren[1] : cleaned).split("\n")[0].trim();

    if (!chunk) return undefined;
    if (/^(?:never|nunca|-)\s*$/i.test(chunk)) return undefined;
    if (/^(?:now|ahora)\s*$/i.test(chunk)) return 0;

    return normalizeTimeToMillis(chunk);
}


/**
 * Extracts the user status from a raw string like "Enrolled student" or "Active".
 * Removes extra whitespace and returns the last word in the string.
 *
 * @param raw - The raw status string extracted from the DOM (e.g., "Enrolled student", "Active").
 * @returns The cleaned status as a single word, or undefined if the input is empty or invalid.
 */

/*
export function parseStatus(raw: string | undefined): string | undefined {
    if (!raw || raw.trim() === '-') return undefined;

    const cleaned = raw.replace(/\s+/g, ' ').trim();
    const parts = cleaned.split(' ').filter(Boolean);

    if (parts.length === 1) return parts[0];

    const filtered = parts.filter(part => part !== "Not" && part !== "current");
    return filtered.join(' ') || "Not current";
}
*/

/**
 * Safely parses the numeric value of a table cell's text content.
 *
 * @param cell - The HTML element representing the cell (typically a <td> or <th>).
 * @returns The integer value parsed from the cell, or 0 if the content is invalid or not a number.
 */

/*
export function parseCellToInt(cell: Element | null): number {
    const text = cell?.textContent?.trim() ?? '';
    const value = parseInt(text);
    return isNaN(value) ? 0 : value;
}
 */

/**
 * Parses a string like "180 views by 86 users" into numeric values.
 *
 * @param raw - The raw string containing view and user counts.
 * @returns An object with `numViews` and `numUsers`, both defaulting to 0 if not found.
 */
export function parseViewsAndUsers(raw: string): { numViews: number; numUsers: number } {
    const text = (raw ?? "").replace(/\u00A0/g, " ").trim();

    const NUM_TOKEN_RE = /\d[\d.,\s]*/g;
    const matches = text.match(NUM_TOKEN_RE) ?? [];

    const toInt = (s: string): number => {
        const n = parseInt(s.replace(/[.,\s]/g, ""), 10);
        return Number.isFinite(n) ? n : 0;
    };

    const views = toInt(matches[0] ?? "0");
    const users = toInt(matches[1] ?? "0");

    return {numViews: views, numUsers: users};
}


/**
 * Converts a JavaScript Date object into a human-readable relative time string.
 *
 * For example, "3 days", "2 hours", "5 minutes", or "a few seconds".
 *
 * @param date - The past Date to compare against the current time.
 * @param t
 * @returns A string representing how much time has passed since the given date.
 */
export function getRelativeTime(date: Date, t: (key: string, options?: any) => string): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffDays > 0) {
        return t("relative.days", {count: diffDays});
    }
    if (diffHrs > 0) {
        return t("relative.hours", {count: diffHrs});
    }
    if (diffMin > 0) {
        return t("relative.minutes", {count: diffMin});
    }
    return t("relative.seconds");
}

