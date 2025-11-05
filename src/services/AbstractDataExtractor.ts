/**
 * @file AbstractDataExtractor.ts
 * @description
 * Abstract base class for all Moodle data extractor implementations (Prod/Local).
 * Provides common scraping utilities (fetching, DOM parsing, helpers) and defines
 * abstract hooks for environment-specific behavior (selectors, URLs, parsing logic).
 *
 * Subclasses such as ProdDataExtractor and LocalDataExtractor extend this class
 * and implement the abstract methods to adapt to the DOM structure of their
 * respective Moodle environments.
 *
 * @note Centralizing shared logic here avoids code duplication and ensures
 *       consistency between different extractor implementations.
 *
 * @author
 * Raúl García Balongo
 * @date 2025
 */

import {Participant} from "../models/Participant";
import {Quiz} from "../models/Quiz";
import {Forum, ForumParticipantData} from "../models/Forum";
import {Choice} from "../models/Choice";
import {Course} from "../models/Course";
import {devlog} from "../utils/devlog";
import {
    getScrapeUrlChoice,
    getScrapeUrlForumMain,
    getScrapeUrlForumReports,
    getScrapeUrlForumSubscriptions
} from "../utils/urlBuilder";

/**
 * Progress tracker used during long-running scraping operations.
 * Subclasses can use it to update a progress bar or loader in the UI.
 */
export type AnalysisProgress = {
    start: (label?: string) => void;
    setTotal: (n: number) => void;
    tick: (inc?: number) => void;
    setLabel: (label: string) => void;
    complete: () => void;
};

/**
 * Abstract base class for all data extractor implementations (prod/local).
 * Each method corresponds to a scraping operation that retrieves data
 * from a specific Moodle course section.
 *
 * Subclasses (e.g., ProdDataExtractor, LocalDataExtractor) must implement
 * all abstract methods. Common logic will be centralized here.
 */
export abstract class AbstractDataExtractor {

    protected async fetchAndParse(url: string): Promise<Document> {
        const response = await fetch(url);
        const html = await response.text();
        return new DOMParser().parseFromString(html, "text/html");
    }

    /**
     * Scrapes the total number of participants from the given participants URL.
     */
    abstract scrapeNumParticipants(participantsUrl: string): Promise<number | null>;

    /**
     * Scrapes the list of participants from the given participants URL.
     */
    abstract scrapeParticipants(participantsUrl: string, courseId: string): Promise<Participant[]>;

    /**
     * Scrapes the course main page and retrieves the course name or identifier.
     */
    async scrapeCourseMain(courseMainUrl: string): Promise<string> {
        const t0 = performance.now();
        devlog.info("dataExtractor", "scrapeCourseMain:start", {courseMainUrl});

        try {
            const doc = await this.fetchAndParse(courseMainUrl);

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
     * Scrapes all Choice activities within a course.
     */
    /**
     * Scrapes all Choice activities within a course.
     */
    async scrapeChoices(
        id: number,
        activityName: string,
        numViews: number,
        numUsers: number,
        lastAccess: number | undefined
    ): Promise<Choice[]> {
        const t0 = performance.now();
        devlog.info("dataExtractor", "scrapeChoices:start",
            {id, activityName, numViews, numUsers, lastAccess});

        try {
            const choices: Choice[] = [];

            const url = getScrapeUrlChoice(id);

            const doc = await this.fetchAndParse(url.choiceResults);

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
     * Scrapes all Quiz activities within a course.
     */
    abstract scrapeQuizzes(
        id: number,
        activityName: string,
        numViews: number,
        numUsers: number,
        lastAccess: number | undefined,
        totalParticipants: number
    ): Promise<Quiz[]>;

    /**
     * Scrapes all Forum activities within a course.
     */
    /**
     * Scrapes all Forum activities within a course.
     */
    async scrapeForums(
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
            let doc = await this.fetchAndParse(urlForumMain.forumMain);

            const reportLink =
                doc.querySelector<HTMLAnchorElement>('a[href*="forumid="]');
            const reportHref = reportLink?.getAttribute("href") ?? "";
            const forumId = parseInt(reportHref.match(/[?&]forumid=(\d+)/)?.[1] ?? "0", 10);

            // --- 2) Subscriptions page: prefer numeric in the heading; fallback = row count ---
            const urlForumSubscriptions = getScrapeUrlForumSubscriptions(forumId);
            doc = await this.fetchAndParse(urlForumSubscriptions.forumSubscriptions);

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
            doc = await this.fetchAndParse(urlForumReports.forumReports);

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
            const parseTimestampFromCell =
                (cell: Element | null): number | undefined => {
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

            const rows =
                Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
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
                const discussionsPosted = parseCellInt(getCellByKey(row, "postcount"));// c2 in many themes
                const repliesPosted = parseCellInt(getCellByKey(row, "replycount")); // c3
                const views = parseCellInt(getCellByKey(row, "viewcount"));    // c5
                const wordCount = parseCellInt(getCellByKey(row, "wordcount"));    // c6
                const earliestPost =
                    parseTimestampFromCell(getCellByKey(row, "earliestpost"));// c8
                const mostRecentPost =
                    parseTimestampFromCell(getCellByKey(row, "latestpost"));  // c9

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
     * Orchestrates the scraping of a full course, including its metadata
     * and all activities (participants, quizzes, forums, choices, etc.).
     */
    abstract scrapeCourse(
        courseId: string,
        courseMainUrl: string,
        activityReportUrl: string,
        participantsUrl: string,
        totalParticipants: number,
        progress?: AnalysisProgress
    ): Promise<Course>;
}
