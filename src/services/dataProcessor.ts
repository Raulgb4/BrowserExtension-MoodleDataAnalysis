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

    const trimmed = input.trim().toLowerCase();
    if (trimmed === 'never' || trimmed === '-') return undefined;

    // Try to parse full date string (e.g., "Tuesday, 18 October 2022, 6:49 PM")
    const parsedDate = Date.parse(trimmed);
    if (!isNaN(parsedDate)) return parsedDate;

    // Parse as duration
    const daysMatch = trimmed.match(/(\d+)\s*days?/);
    const hoursMatch = trimmed.match(/(\d+)\s*hours?/);
    const minsMatch = trimmed.match(/(\d+)\s*mins?/);
    const secsMatch = trimmed.match(/(\d+)\s*secs?/);
    const oneDayMatch = trimmed.match(/1\s*day/);
    const oneHourMatch = trimmed.match(/1\s*hour/);
    const oneMinMatch = trimmed.match(/1\s*min/);
    const oneSecMatch = trimmed.match(/1\s*sec/);
    const yearsMatch = trimmed.match(/(\d+)\s*years?/);
    const oneYearMatch = trimmed.match(/1\s*year/);

    const days = daysMatch ? parseInt(daysMatch[1]) : (oneDayMatch ? 1 : 0);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : (oneHourMatch ? 1 : 0);
    const mins = minsMatch ? parseInt(minsMatch[1]) : (oneMinMatch ? 1 : 0);
    const secs = secsMatch ? parseInt(secsMatch[1]) : (oneSecMatch ? 1 : 0);
    const years = yearsMatch ? parseInt(yearsMatch[1]) : (oneYearMatch ? 1 : 0);

    return (
        years * 365 * 24 * 60 * 60 * 1000 +
        days * 24 * 60 * 60 * 1000 +
        hours * 60 * 60 * 1000 +
        mins * 60 * 1000 +
        secs * 1000
    );
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
export function parseGroups(raw: string | undefined): string[] | undefined {
    if (!raw || raw.trim() === '-' || raw.toLowerCase().includes('no groups')) return undefined;
    return raw.split(',').map(g => g.trim());
}

/**
 * Parses a raw "last access" string (e.g., "5 mins 30 secs") into milliseconds.
 * Returns undefined if the input is "Never", "-", or empty.
 *
 * @param raw - The raw last access string from Moodle.
 * @returns The duration in milliseconds, or undefined if the input is not a valid time.
 */
export function parseLastAccess(raw: string | undefined): number | undefined {
    if (!raw || raw.toLowerCase() === 'never' || raw === '-') return undefined;
    return normalizeTimeToMillis(raw.trim());
}

/**
 * Extracts the user status from a raw string like "Enrolled student" or "Active".
 * Removes extra whitespace and returns the last word in the string.
 *
 * @param raw - The raw status string extracted from the DOM (e.g., "Enrolled student", "Active").
 * @returns The cleaned status as a single word, or undefined if the input is empty or invalid.
 */
export function parseStatus(raw: string | undefined): string | undefined {
    if (!raw || raw.trim() === '-') return undefined;

    const cleaned = raw.replace(/\s+/g, ' ').trim();
    const parts = cleaned.split(' ').filter(Boolean);

    if (parts.length === 1) return parts[0];

    const filtered = parts.filter(part => part !== "Not" && part !== "current");
    return filtered.join(' ') || "Not current";
}

/**
 * Safely parses the numeric value of a table cell's text content.
 *
 * @param cell - The HTML element representing the cell (typically a <td> or <th>).
 * @returns The integer value parsed from the cell, or 0 if the content is invalid or not a number.
 */
export function parseCellToInt(cell: Element | null): number {
    const text = cell?.textContent?.trim() ?? '';
    const value = parseInt(text);
    return isNaN(value) ? 0 : value;
}

/**
 * Parses a string like "180 views by 86 users" into numeric values.
 *
 * @param raw - The raw string containing view and user counts.
 * @returns An object with `numViews` and `numUsers`, both defaulting to 0 if not found.
 */
export function parseViewsAndUsers(raw: string): { numViews: number; numUsers: number } {
    const match = raw.match(/(\d+)\s+views?\s+by\s+(\d+)\s+users?/);
    return {
        numViews: match ? parseInt(match[1]) : 0,
        numUsers: match ? parseInt(match[2]) : 0,
    };
}

/**
 * Converts a JavaScript Date object into a human-readable relative time string.
 *
 * For example: "3 days", "2 hours", "5 minutes", or "a few seconds".
 *
 * @param date - The past Date to compare against the current time.
 * @returns A string representing how much time has passed since the given date.
 */
export function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
    if (diffHrs > 0) return `${diffHrs} hour${diffHrs > 1 ? "s" : ""}`;
    if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? "s" : ""}`;
    return `a few seconds`;
}