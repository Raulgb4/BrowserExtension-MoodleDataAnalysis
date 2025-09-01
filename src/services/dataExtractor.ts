/**
 * @file dataExtractor.ts
 * @description Centralized module for scraping various Moodle course sections
 *
 * @author Raúl García Balongo
 * @date 2025
 */

// Models
import {Participant} from '../models/Participant';
import {Resource, URLResource, Workshop} from '../models/ActivityBase';
import {Quiz, QuizParticipantData} from '../models/Quiz';
import {Forum, ForumParticipantData} from '../models/Forum';
import {Choice} from '../models/Choice';
import {Course} from '../models/Course';

// Data processing utilities
import {normalizeGradeTo10, parseLastAccess, parseRoles, parseViewsAndUsers} from './dataProcessor';

// URL builders
import {
    getScrapeUrlChoice,
    getScrapeUrlForumMain,
    getScrapeUrlForumReports,
    getScrapeUrlForumSubscriptions,
    getScrapeUrlQuiz
} from '../utils/urlBuilder';
import {devlog} from "../utils/devlog";

/**
 * Fetches the content of a given URL and parses it into a DOM Document.
 *
 * This utility function simplifies HTML scraping by combining the fetch and
 * DOM parsing steps. It is useful for consistently retrieving and parsing
 * HTML content across multiple scraping operations.
 *
 * @param url - The URL to fetch the HTML content from.
 * @returns A Promise that resolves to a parsed HTML Document.
 *
 * @throws Will propagate any network or parsing errors encountered during the fetch.
 */
async function fetchAndParse(url: string): Promise<Document> {
    const response = await fetch(url);
    const html = await response.text();
    return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * Retrieves the total number of participants from the Moodle participants page.
 *
 * This function fetches the HTML content of the given participants URL,
 * locates the dynamic table element, and extracts the total number of rows
 * from the corresponding HTML attribute.
 *
 * @param participantsUrl - The full URL of the Moodle participants page to scrape.
 * @returns The total number of participants as a number, or null if not found, or an error occurs.
 */
export async function scrapeNumParticipants(participantsUrl: string): Promise<number | null> {
    const t0 = performance.now();
    devlog.info("dataExtractor", "scrapeNumParticipants:start", {participantsUrl});

    try {
        const doc = await fetchAndParse(participantsUrl);

        // Helper: get largest integer from a visible text string.
        const extractLargestInteger = (text?: string | null): number | null => {
            if (!text) return null;
            // Match numbers with optional a thousand separators: 1.234 / 1,234 / 1234
            const matches = text.match(/(\d{1,3}(?:[.,\s]\d{3})*|\d+)/g);
            if (!matches) return null;

            const nums = matches
                .map(s => parseInt(s.replace(/[.,\s]/g, ""), 10))
                .filter(n => Number.isFinite(n));

            if (nums.length === 0) return null;
            return Math.max(...nums);
        };

        // 1) Prefer the "Show all N" anchor — aria-label is often unlocalized ("Showall") in Moodle;
        //    data-action is language-agnostic too.
        const showAllAnchor =
            doc.querySelector<HTMLAnchorElement>("a[aria-label='Showall']") ||
            doc.querySelector<HTMLAnchorElement>("a.page-link[data-action='showalllink']");

        let total =
            extractLargestInteger(showAllAnchor?.textContent?.trim() ?? "") ?? null;

        // 2) Fallback: counter container (works in ES/EN because we only read digits).
        if (total === null) {
            const counterEl = doc.querySelector<HTMLElement>(".participantes_mostrados span");
            total = extractLargestInteger(counterEl?.textContent?.trim() ?? "") ?? null;
        }

        // 3) Fallback: ARIA rowcount on the participant table/grid (if provided by the theme).
        if (total === null) {
            const rowcountHost =
                doc.querySelector<HTMLElement>("table[aria-rowcount]") ||
                doc.querySelector<HTMLElement>("[role='grid'][aria-rowcount]");

            const rc = rowcountHost?.getAttribute("aria-rowcount");
            if (rc) {
                const n = parseInt(rc, 10);
                if (Number.isFinite(n)) total = n;
            }
        }

        const ms = Math.round(performance.now() - t0);

        if (total === null || Number.isNaN(total)) {
            devlog.error("dataExtractor", "scrapeNumParticipants:not found", {durationMs: ms});
            return null;
        }

        devlog.info("dataExtractor", "scrapeNumParticipants:success", {total, durationMs: ms});
        return total;
    } catch (error) {
        const ms = Math.round(performance.now() - t0);
        devlog.error("dataExtractor", "scrapeNumParticipants:error", {error: String(error), durationMs: ms});
        return null;
    }
}


/**
 * Scrapes the participant list from a Moodle course page (#participant table).
 *
 * The function fetches and parses the HTML document, iterates over table rows,
 * and extracts:
 *  - id (from /user/view.php?id=...)
 *  - participantName (link text in th.cell.c2)
 *  - email (from .correo_lista_participantes; falls back to mailto: href)
 *  - roles (via parseRoles)
 *  - lastAccessToCourse (via parseLastAccess; handles UMA “1 year 230 d” style)
 *  - registration (raw text from td.cell.c5)
 *
 * Rows lacking a valid profile link, id, or name are skipped.
 * If the table is not present or an error occurs, an empty array is returned.
 *
 * @param participantsUrl Full URL of the Moodle participants page to scrape.
 * @returns Promise resolving to an array of Participant items (or [] on failure).
 */
export async function scrapeParticipants(participantsUrl: string): Promise<Participant[]> {
    const t0 = performance.now();
    devlog.info("dataExtractor", "scrapeParticipants:start", {participantsUrl});

    try {
        const doc = await fetchAndParse(participantsUrl);

        const table = doc.querySelector<HTMLTableElement>("#participants");
        if (!table) {
            const ms = Math.round(performance.now() - t0);
            devlog.error("dataExtractor", "scrapeParticipants:participants table not found",
                {durationMs: ms});
            return [];
        }

        const rows = Array.from(table.querySelectorAll("tbody tr") ?? []);

        const participants: Participant[] = [];

        for (const row of rows) {
            const nameCell = row.querySelector<HTMLElement>("th.cell.c2");
            if (!nameCell) continue;

            const profileLink =
                nameCell.querySelector<HTMLAnchorElement>('a[href*="/user/view.php"]');
            if (!profileLink) continue;

            const participantName = profileLink.textContent?.trim() ?? "";
            if (!participantName) continue;

            const href = profileLink.getAttribute("href") ?? "";
            const idMatch = href.match(/[?&]id=(\d+)/);
            if (!idMatch) continue;
            const id = parseInt(idMatch[1], 10);
            if (Number.isNaN(id)) continue;

            const email =
                nameCell.querySelector<HTMLAnchorElement>
                ("a.correo_lista_participantes")?.textContent?.trim() ?? "";

            // Roles: td.cell.c3
            const rolesRaw = row.querySelector<HTMLElement>("td.cell.c3")?.innerText?.trim();
            const roles = parseRoles(rolesRaw);

            // Last access: td.cell.c4
            const lastAccessRaw =
                row.querySelector<HTMLElement>("td.cell.c4")?.innerText?.trim();
            const lastAccessToCourse = parseLastAccess(lastAccessRaw);

            // Registration: td.cell.c5
            const registrationRaw =
                row.querySelector<HTMLElement>("td.cell.c5")?.innerText?.trim() ?? "";
            const registration = registrationRaw || undefined;

            const participant: Participant = {
                id,
                participantName,
                email,
                roles,
                lastAccessToCourse,
                registration,
            };

            participants.push(participant);
        }

        const ms = Math.round(performance.now() - t0);
        devlog.info("dataExtractor", "scrapeParticipants:done", {
            rows: rows.length,
            collected: participants.length,
            durationMs: ms,
        });

        return participants;
    } catch (error) {
        const ms = Math.round(performance.now() - t0);
        devlog.error("dataExtractor", "scrapeParticipants:error", {error: String(error), durationMs: ms});
        return [];
    }
}


/**
 * Scrapes the main course page to extract the course name (title).
 *
 * This function parses the main view of a Moodle course to retrieve the official course title
 * displayed inside the page header, typically within a <h1> element.
 *
 * @param courseMainUrl - The full URL of the Moodle course view page (e.g., /course/view.php?id=123).
 * @returns A promise that resolves to the course name as a string.
 */
export async function scrapeCourseMain(courseMainUrl: string): Promise<string> {
    const t0 = performance.now();
    devlog.info("dataExtractor", "scrapeCourseMain:start", {courseMainUrl});

    try {
        const doc = await fetchAndParse(courseMainUrl);

        const selector = ".page-context-header h1";
        const titleNode = doc.querySelector(selector);
        const courseName = titleNode?.textContent?.trim();

        if (!courseName) {
            const ms = Math.round(performance.now() - t0);
            devlog.error("dataExtractor", "scrapeCourseMain:course name not found",
                {selector, durationMs: ms});
            return "";
        }

        const ms = Math.round(performance.now() - t0);
        devlog.info("dataExtractor", "scrapeCourseMain:success", {courseName, durationMs: ms});
        return courseName;

    } catch (error) {
        const ms = Math.round(performance.now() - t0);
        devlog.error("dataExtractor", "scrapeCourseMain:error", {error: String(error), durationMs: ms});
        return "";
    }
}

/**
 * Scrapes the response data from a specific Choice activity in Moodle.
 *
 * This function retrieves the options available in the Choice activity and the number
 * of responses submitted for each option, based on the result table in the activity's page.
 *
 * @param id - The unique identifier of the Choice activity.
 * @param activityName - The display name of the activity as shown in the course.
 * @param numViews - The total number of times the activity has been viewed.
 * @param numUsers - The number of unique users who viewed the activity.
 * @param lastAccess - The timestamp (in milliseconds) of the last recorded access to the activity.
 * @returns A promise that resolves to an array containing a single `Choice` object with response data,
 *          or an empty array if scraping fails.
 */
export async function scrapeChoices(
    id: number,
    activityName: string,
    numViews: number,
    numUsers: number,
    lastAccess: number | undefined,
): Promise<Choice[]> {
    const t0 = performance.now();
    devlog.info("dataExtractor", "scrapeChoices:start", {id, activityName, numViews, numUsers, lastAccess});

    try {
        const choices: Choice[] = [];

        const url = getScrapeUrlChoice(id);

        const doc = await fetchAndParse(url.choiceResults);

        const responseCounts: Record<string, number> = {};

        const headerCells = doc.querySelectorAll('table.results.names thead tr th');
        const labelCells = Array.from(headerCells)
            .slice(1) // skip the first column
            .map(th => th.querySelector('div.text-center')?.childNodes[0]?.textContent?.trim())
            .filter((label): label is string => !!label); // filter out undefined/null

        const responseCells = doc.querySelectorAll('table.results.names tbody tr td');

        responseCells.forEach((cell, i) => {
            const label = labelCells[i];
            if (!label) return;

            const value = parseInt(cell.textContent?.trim() ?? '0', 10);
            responseCounts[label] = isNaN(value) ? 0 : value;
        });

        const choice: Choice = {
            id,
            activityName,
            numViews,
            numUsers,
            lastAccess,
            responseCounts
        };

        choices.push(choice);

        const ms = Math.round(performance.now() - t0);
        devlog.info("dataExtractor", "scrapeChoices:success", {id, activityName, durationMs: ms}, choice);

        return choices;

    } catch (error) {
        const ms = Math.round(performance.now() - t0);
        devlog.error("dataExtractor", "scrapeChoices:error", {error: String(error), durationMs: ms});
        return [];
    }
}

/**
 * Scrapes detailed quiz results for a specific Moodle quiz activity.
 *
 * This function retrieves each participant's performance data in the quiz, including
 * duration, raw grade, and normalized grade. It also extracts the maximum possible grade
 * for normalization and compiles all data into a `Quiz` object.
 *
 * @param id - The unique identifier of the quiz activity.
 * @param activityName - The display name of the quiz as shown in the course.
 * @param numViews - The total number of views for the quiz.
 * @param numUsers - The number of unique users who viewed the quiz.
 * @param lastAccess - The timestamp (in milliseconds) of the last recorded access to the quiz.
 * @param totalParticipants - The total number of participants in the course, used for URL construction.
 * @returns A promise that resolves to an array containing a single `Quiz` object with participant results,
 *          or an empty array if scraping fails.
 */
export async function scrapeQuizzes(
    id: number,
    activityName: string,
    numViews: number,
    numUsers: number,
    lastAccess: number | undefined,
    totalParticipants: number
): Promise<Quiz[]> {
    const t0 = performance.now();
    devlog.info("dataExtractor", "scrapeQuizzes:start", {
        id, activityName, numViews, numUsers, lastAccess, totalParticipants
    });

    try {
        const quizzes: Quiz[] = [];
        const url = getScrapeUrlQuiz(id, totalParticipants);
        const doc = await fetchAndParse(url.quizResults);

        /**
         * Parse a locale-agnostic number from a string.
         * Handles: "10,00", "1.000,50", "1,000.50", "-0,25", "-0.25".
         */
        const parseLocaleNumber = (raw: string | null | undefined): number | null => {
            if (!raw) return null;
            const s = raw.replace(/\u00A0/g, " ").trim(); // normalize NBSP
            if (!s) return null;

            // Keep sign; strip everything except digits, separators
            const neg = /^\s*-/.test(s);
            const body = s.replace(/[^0-9.,]/g, "");
            if (!body) return null;

            // Decide decimal separator as the rightmost of [., ] and remove others as thousands
            const lastDot = body.lastIndexOf(".");
            const lastComma = body.lastIndexOf(",");
            const lastSep = Math.max(lastDot, lastComma);

            let numStr: string;
            if (lastSep === -1) {
                numStr = body;
            } else {
                const intPart = body.slice(0, lastSep).replace(/[.,]/g, "");
                const fracPart = body.slice(lastSep + 1).replace(/[.,]/g, "");
                numStr = intPart + (fracPart ? "." + fracPart : "");
            }

            const n = Number(numStr);
            if (!Number.isFinite(n)) return null;
            return neg ? -n : n;
        };

        /**
         * Language-agnostic duration parser to milliseconds.
         * Supports:
         *  - "HH:MM:SS" or "MM:SS"
         *  - Free-text with numbers: "46 mins 32 secs", "46 min 32 s", "1 h 2 m 3 s"
         * Strategy: prefer a colon format; otherwise, use 1–3 integers as [h,m,s] by count.
         */
        const parseDurationToMillis =
            (raw: string | null | undefined): number | undefined => {
                if (!raw) return undefined;
                const txt = raw.replace(/\u00A0/g, " ").trim();

                // 1) Colon-based format
                const colon = txt.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
                if (colon) {
                    const h = colon[3] !== undefined ? parseInt(colon[1], 10) : 0;
                    const m = colon[3] !== undefined ? parseInt(colon[2], 10) : parseInt(colon[1], 10);
                    const s = colon[3] !== undefined ? parseInt(colon[3], 10) : parseInt(colon[2], 10);
                    return ((h * 3600) + (m * 60) + s) * 1000;
                }

                // 2) Generic numbers (assume H M S by count)
                const nums =
                    (txt.match(/\d+/g) || []).map(n => parseInt(n, 10)).filter(Number.isFinite);
                if (nums.length === 0) return undefined;
                let h = 0, m: number, s = 0;
                if (nums.length === 1) {
                    m = nums[0];
                } else if (nums.length === 2) {
                    m = nums[0];
                    s = nums[1];
                } else {
                    h = nums[0];
                    m = nums[1];
                    s = nums[2];
                }
                return ((h * 3600) + (m * 60) + s) * 1000;
            };

        /**
         * Get max grade from the header link for the "grade" column.
         * Prefer an anchor with data-sortby="sumgrades" or href containing tsort=sumgrades.
         * Extract the last numeric token (e.g., "Grade/1.00", "Calificación/10,00").
         */
        const findMaxGrade = (root: Document): number => {
            const headerAnchor =
                root.querySelector<HTMLAnchorElement>('table#attempts thead a[data-sortby="sumgrades"]') ||
                root.querySelector<HTMLAnchorElement>('a[data-sortby="sumgrades"]') ||
                root.querySelector<HTMLAnchorElement>('a[href*="tsort=sumgrades"]');

            if (headerAnchor) {
                // Include inner text (and access hide content if present).
                const text = headerAnchor.textContent?.trim() ?? "";
                const matches = text.match(/\d+(?:[.,]\d+)?/g);
                if (matches && matches.length) {
                    const last = matches[matches.length - 1];
                    const parsed = parseLocaleNumber(last);
                    if (parsed && parsed > 0) return parsed;
                }
            }

            // Fallback: 10 or 1 (conservative default if header not found).
            // Prefer 10 because many Moodle quizzes use /10. Adjust if your deployment uses /1 mostly.
            return 10;
        };

        // Locate results table (Moodle uses #attempts in an overview report)
        const tableResultsQuiz = doc.querySelector<HTMLTableElement>("table#attempts");
        if (!tableResultsQuiz) {
            const msNF = Math.round(performance.now() - t0);
            devlog.warn("dataExtractor", "scrapeQuizzes:results table not found", {durationMs: msNF});
            return [];
        }

        const maxGrade = findMaxGrade(doc);

        // Collect attempt rows only: they contain the primary checkbox input
        const rowsResultsQuiz = Array.from(tableResultsQuiz.querySelectorAll("tbody tr"))
            .filter(tr => tr.querySelector('input[name="attemptid[]"]'));

        const participantStats: QuizParticipantData[] = [];

        // Skip counters (no PII)
        let skipEmptyRow = 0;
        let skipNoNameAnchor = 0;
        let skipNoId = 0;
        let skipNaNId = 0;
        let skipNoGrade = 0;

        for (const row of rowsResultsQuiz) {
            // Name cell: find the user profile anchor (language-agnostic URL)
            const nameAnchor =
                row.querySelector<HTMLAnchorElement>('td a[href*="/user/view.php"]');
            if (!nameAnchor) {
                skipNoNameAnchor++;
                continue;
            }
            const participantName = (nameAnchor.textContent || "").trim();

            // Extract participant id from profile URL
            const idMatch =
                nameAnchor.getAttribute("href")?.match(/[?&]id=(\d+)/);
            if (!idMatch) {
                skipNoId++;
                continue;
            }
            const participantId = parseInt(idMatch[1], 10);
            if (Number.isNaN(participantId)) {
                skipNaNId++;
                continue;
            }

            // Grade cell: an anchor-to-review attempt is stable across locales
            const gradeAnchor =
                row.querySelector<HTMLAnchorElement>('td a[href*="/mod/quiz/review.php?attempt="]');
            if (!gradeAnchor) {
                // Some rows (rare) might be incomplete; skip
                skipNoGrade++;
                continue;
            }
            const gradeCell = gradeAnchor.closest("td") as HTMLTableCellElement | null;

            // Duration cell: typically the immediate previous sibling of a grade column
            let durationMs: number | undefined = undefined;
            if (gradeCell && gradeCell.previousElementSibling
                && gradeCell.previousElementSibling instanceof HTMLTableCellElement) {
                const rawDuration = gradeCell.previousElementSibling.textContent?.trim() ?? "";
                durationMs = parseDurationToMillis(rawDuration);
            }

            // Grade value (locale-agnostic)
            const rawGrade = gradeAnchor.textContent?.trim() ?? "";
            const parsedGrade = parseLocaleNumber(rawGrade) ?? NaN;
            if (!Number.isFinite(parsedGrade)) {
                skipNoGrade++;
                continue;
            }

            const normalizedGrade = normalizeGradeTo10(parsedGrade, maxGrade);

            const participantData: QuizParticipantData = {
                participantId,
                participantName,
                duration: durationMs,
                grade: parsedGrade,
                normalizedGrade,
            };

            participantStats.push(participantData);
        }

        // If no rows were selected at all, count as empty
        if (rowsResultsQuiz.length === 0) {
            skipEmptyRow++;
        }

        const quiz: Quiz = {
            activityName,
            numViews,
            numUsers,
            lastAccess,
            id,
            maxGrade,
            participantStats,
        };

        quizzes.push(quiz);

        const ms = Math.round(performance.now() - t0);
        devlog.info("dataExtractor", "scrapeQuizzes:success", {
            id,
            activityName,
            maxGrade,
            participantsParsed: participantStats.length,
            skipped: {
                emptyRow: skipEmptyRow,
                noNameCell: skipNoNameAnchor,
                noId: skipNoId,
                nanId: skipNaNId,
                noGrade: skipNoGrade,
            },
            durationMs: ms,
        }, quiz); // optional: full object for inspection

        return quizzes;

    } catch (error) {
        const ms = Math.round(performance.now() - t0);
        devlog.error("dataExtractor", "scrapeQuizzes:error", {error: String(error), durationMs: ms});
        return [];
    }
}

/**
 * Scrapes participation statistics from a Moodle forum activity.
 *
 * This function collects data from multiple forum-related pages including
 * - Main forum page (to extract forum ID)
 * - Subscriptions page (to count subscribed users)
 * - Forum report page (to gather per-participant activity stats)
 *
 * It compiles participant metrics such as posts, replies, views, word count, and timestamps
 * of the earliest and most recent posts and returns them in a structured `Forum` object.
 *
 * @param id - The unique identifier of the forum activity.
 * @param activityName - The display name of the forum as shown in the course.
 * @param numViews - The total number of views for the forum.
 * @param numUsers - The number of unique users who viewed the forum.
 * @param lastAccess - The timestamp (in milliseconds) of the last recorded access to the forum.
 * @param totalParticipants - The total number of course participants (used for table rendering).
 * @param courseId - The unique identifier of the Moodle course.
 * @returns A promise that resolves to an array containing a single `Forum` object with participant data,
 *          or an empty array if scraping fails.
 */
export async function scrapeForums(
    id: number,
    activityName: string,
    numViews: number,
    numUsers: number,
    lastAccess: number | undefined,
    totalParticipants: number,
    courseId: string
): Promise<Forum[]> {
    const t0 = performance.now();
    devlog.info("dataExtractor", "scrapeForums:start", {
        id, activityName, numViews, numUsers, lastAccess, totalParticipants, courseId
    });

    try {
        // --- 1) Forum main → get forumId (language-agnostic via URL param) ---
        const urlForumMain = getScrapeUrlForumMain(id);
        let doc = await fetchAndParse(urlForumMain.forumMain);

        const reportLink = doc.querySelector<HTMLAnchorElement>('a[href*="forumid="]');
        const reportHref = reportLink?.getAttribute("href") ?? "";
        const forumId = parseInt(reportHref.match(/[?&]forumid=(\d+)/)?.[1] ?? "0", 10);

        // --- 2) Subscriptions page: prefer numeric in the heading; fallback = row count ---
        const urlForumSubscriptions = getScrapeUrlForumSubscriptions(forumId);
        doc = await fetchAndParse(urlForumSubscriptions.forumSubscriptions);

        let subscriptions: number;
        const countInH2 = Array.from(doc.querySelectorAll("h2"))
            .map(h => (h.textContent ?? "").match(/\(\s*(\d+)\s*\)/)?.[1])
            .filter(Boolean)
            .map(n => parseInt(n!, 10))[0];

        if (Number.isFinite(countInH2)) {
            subscriptions = countInH2!;
        } else {
            // Fallback: count users listed in the table (language-agnostic)
            subscriptions = doc.querySelectorAll("table.generaltable tbody tr").length;
        }

        // --- 3) Forum summary report table (language-agnostic via IDs and data-sortby) ---
        const urlForumReports = getScrapeUrlForumReports(courseId, forumId, totalParticipants);
        doc = await fetchAndParse(urlForumReports.forumReports);

        const table =
            doc.querySelector<HTMLTableElement>("table#forumreport_summary_table");
        if (!table) {
            const msNF = Math.round(performance.now() - t0);
            devlog.warn("dataExtractor", "scrapeForums:summary table not found", {durationMs: msNF});
            return [];
        }

        // Build a header map: data-sortby -> column index
        const headerIndex = new Map<string, number>();
        Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).forEach((th,
                                                                                      idx) => {
            const a = th.querySelector<HTMLAnchorElement>("a[data-sortby]");
            const key = a?.getAttribute("data-sortby");
            if (key) headerIndex.set(key, idx);
        });

        // Helpers to access cells by the header key
        const getCellByKey =
            (row: HTMLTableRowElement, key: string): HTMLTableCellElement | null => {
                const idx = headerIndex.get(key);
                if (idx == null) return null;
                const tds = row.querySelectorAll<HTMLTableCellElement>("td");
                return tds[idx] ?? null;
            };

        // Parse a cell containing a date/time in a language-agnostic way.
        const parseTimestampFromCell = (cell: Element | null): number | undefined => {
            if (!cell) return undefined;

            // 1) <time datetime="..."> (ISO 8601)
            const timeEl = cell.querySelector<HTMLTimeElement>("time[datetime]");
            const iso = timeEl?.getAttribute("datetime");
            if (iso) {
                const t = Date.parse(iso);
                if (Number.isFinite(t)) return t;
            }

            // 2) data-* timestamps (seconds or millis)
            const probe = cell.querySelector<HTMLElement>
            ("[data-timestamp],[data-timecreated],[data-timemodified],[data-time]");
            const candAttrs = ["data-timestamp", "data-timecreated", "data-timemodified", "data-time"] as const;
            for (const a of candAttrs) {
                const v = probe?.getAttribute(a);
                if (v && /^\d{10,13}$/.test(v)) {
                    const n = parseInt(v, 10);
                    return n < 2e12 ? n * 1000 : n; // seconds→ms if needed
                }
            }

            // 3) Last resort: look for a 10/13-digit number in the HTML (epoch)
            const html = cell.innerHTML;
            const m = html.match(/\b(\d{13}|\d{10})\b/);
            if (m) {
                const n = parseInt(m[1], 10);
                return n < 2e12 ? n * 1000 : n;
            }

            // Give up (avoid locale text parsing)
            return undefined;
        };

        // Numeric cell parser (robust to a thousand separators)
        const parseCellInt = (cell: HTMLTableCellElement | null): number => {
            const raw = cell?.textContent?.replace(/\u00A0/g, " ").trim() ?? "";
            const digits = raw.match(/[\d.,]+/);
            if (!digits) return 0;
            const cleaned = digits[0].replace(/[.,\s]/g, "");
            const n = parseInt(cleaned, 10);
            return Number.isFinite(n) ? n : 0;
        };

        const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
        const participantsStats: ForumParticipantData[] = [];

        for (const row of rows) {
            // Name: language-agnostic via user profile link
            const nameAnchor =
                row.querySelector<HTMLAnchorElement>('a[href*="/user/view.php"]');
            if (!nameAnchor) continue;

            const participantName =
                (Array.from(nameAnchor.childNodes).find(n => n.nodeType === Node.TEXT_NODE)?.textContent
                    ?? nameAnchor.textContent ?? "").trim();

            const idMatch =
                nameAnchor.getAttribute("href")?.match(/[?&]id=(\d+)/);
            if (!idMatch) continue;
            const participantId = parseInt(idMatch[1], 10);
            if (!Number.isFinite(participantId)) continue;

            // Map metrics by header keys
            const discussionsPosted = parseCellInt(getCellByKey(row, "postcount"));  // c2 in many themes
            const repliesPosted = parseCellInt(getCellByKey(row, "replycount"));   // c3
            const views = parseCellInt(getCellByKey(row, "viewcount"));    // c5
            const wordCount = parseCellInt(getCellByKey(row, "wordcount"));    // c6
            const earliestPost = parseTimestampFromCell(getCellByKey(row, "earliestpost")); // c8
            const mostRecentPost = parseTimestampFromCell(getCellByKey(row, "latestpost"));  // c9

            // Skip pure-zero rows (noise)
            if (discussionsPosted === 0 && repliesPosted === 0 && views === 0 && wordCount === 0) {
                continue;
            }

            participantsStats.push({
                participantId,
                participantName,
                discussionsPosted,
                repliesPosted,
                views,
                wordCount,
                earliestPost,
                mostRecentPost,
            });
        }

        const forum: Forum = {
            activityName,
            numViews,
            numUsers,
            lastAccess,
            id,
            forumId,
            subscriptions,
            participantsStats,
        };

        const forums: Forum[] = [forum];

        const ms = Math.round(performance.now() - t0);
        devlog.info("dataExtractor", "scrapeForums:success", {
            id, forumId, subscriptions, participantsParsed: participantsStats.length, durationMs: ms,
        });

        return forums;
    } catch (error) {
        const ms = Math.round(performance.now() - t0);
        devlog.error("dataExtractor", "scrapeForums:error", {error: String(error), durationMs: ms});
        return [];
    }
}


/**
 * Scrapes all relevant data from a Moodle course, including participants and activity statistics.
 *
 * This function first gathers participant information from the participant page,
 * then parses the activity report page to extract and classify each activity
 * (e.g., forums, quizzes, choices, resources) based on its type.
 * For complex activities, additional scraping is performed to gather detailed statistics.
 *
 * @param courseId - The unique identifier of the Moodle course.
 * @param courseMainUrl
 * @param activityReportUrl - The URL of the course's activity report page.
 * @param participantsUrl - The URL of the course's participant page.
 * @param totalParticipants - The total number of participants enrolled in the course (used in report URLs).
 * @returns A promise that resolves to a `Course` object containing metadata, participants,
 *          and detailed activity data extracted from the course.
 */
export async function scrapeCourse(
    courseId: string,
    courseMainUrl: string,
    activityReportUrl: string,
    participantsUrl: string,
    totalParticipants: number
): Promise<Course> {
    const t0 = performance.now();
    devlog.info("dataExtractor", "scrapeCourse:start", {
        courseId,
        totalParticipants,
        urls: {courseMainUrl, activityReportUrl, participantsUrl},
    });

    try {
        const participants = await scrapeParticipants(participantsUrl);
        const numParticipantsTotal = participants.length;

        const courseName = await scrapeCourseMain(courseMainUrl);
        const doc = await fetchAndParse(activityReportUrl);
        const table = doc.querySelector("table#outlinetable");
        const rows = Array.from(table?.querySelectorAll("tbody tr") ?? []);

        const urlResources: URLResource[] = [];
        const choices: Choice[] = [];
        const workshops: Workshop[] = [];
        const resources: Resource[] = [];
        let quizzes: Quiz[] = [];
        let forums: Forum[] = [];

        const typeCounts = {
            url: 0,
            workshop: 0,
            resource: 0,
            choice: 0,
            quiz: 0,
            forum: 0,
        };

        for (const row of rows) {
            const activityLink =
                row.querySelector<HTMLAnchorElement>('td.activity a[href]');
            if (!activityLink) {
                continue;
            }

            const viewsCell = row.querySelector("td.numviews");
            const lastAccessCell = row.querySelector("td.lastaccess");

            const href = activityLink.getAttribute("href") ?? "";
            const activityName = activityLink.textContent?.trim() ?? "";

            const {numViews, numUsers} = parseViewsAndUsers(viewsCell?.textContent?.trim() ?? "");

            const durationMatch =
                lastAccessCell?.textContent?.match(/\(([^)]+)\)/);
            const relativeDuration = durationMatch?.[1]?.trim();
            const lastAccess = parseLastAccess(relativeDuration);

            const idMatch = href.match(/id=(\d+)/);
            if (!idMatch) {
                continue;
            }
            const id = parseInt(idMatch[1], 10);

            switch (true) {
                case href.includes("/mod/url/"):
                    urlResources.push({activityName, numViews, numUsers, lastAccess});
                    typeCounts.url++;
                    break;

                case href.includes("/mod/workshop/"):
                    workshops.push({activityName, numViews, numUsers, lastAccess});
                    typeCounts.workshop++;
                    break;

                case href.includes("/mod/resource/"):
                    resources.push({activityName, numViews, numUsers, lastAccess});
                    typeCounts.resource++;
                    break;

                case href.includes("/mod/choice/"): {
                    const choiceResults =
                        await scrapeChoices(id, activityName, numViews, numUsers, lastAccess);
                    choices.push(...choiceResults);
                    typeCounts.choice += choiceResults.length;
                    break;
                }

                case href.includes("/mod/quiz/"): {
                    const quizResults = await scrapeQuizzes(
                        id,
                        activityName,
                        numViews,
                        numUsers,
                        lastAccess,
                        totalParticipants
                    );
                    quizzes.push(...quizResults);
                    typeCounts.quiz += quizResults.length;
                    break;
                }

                case href.includes("/mod/forum/"): {
                    const forumResults = await scrapeForums(
                        id,
                        activityName,
                        numViews,
                        numUsers,
                        lastAccess,
                        totalParticipants,
                        courseId
                    );
                    forums.push(...forumResults);
                    typeCounts.forum += forumResults.length;
                    break;
                }
            }
        }

        const course: Course = {
            id: parseInt(courseId, 10),
            courseName,
            numParticipantsTotal,
            participants,
            urlResources,
            resources,
            choices,
            workshops,
            quizzes,
            forums,
        };

        const ms = Math.round(performance.now() - t0);
        devlog.info(
            "dataExtractor",
            "scrapeCourse:success. SCRAPING FINISHED",
            {
                courseId,
                courseName,
                numParticipantsTotal,
                durationMs: ms,
                totals: {
                    urlResources: urlResources.length,
                    resources: resources.length,
                    choices: choices.length,
                    workshops: workshops.length,
                    quizzes: quizzes.length,
                    forums: forums.length,
                },
            },
            course
        );

        return course;
    } catch (error) {
        const ms = Math.round(performance.now() - t0);
        devlog.error("dataExtractor", "scrapeCourse:error", {error: String(error), durationMs: ms});
        throw error;
    }
}

