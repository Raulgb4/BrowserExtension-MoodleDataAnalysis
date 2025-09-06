/**
 * @file dataExtractorProd.ts
 * @description Production implementation of IDataExtractor for Moodle UMA.
 * Contains scraping logic adapted to the DOM of the official Moodle environment.
 *
 * @author
 * Raúl García Balongo
 * @date 2025
 */

import {AnalysisProgress, IDataExtractor} from "./IDataExtractor";

// Models
import {Participant} from "../models/Participant";
import {Quiz, QuizParticipantData} from "../models/Quiz";
import {Forum, ForumParticipantData} from "../models/Forum";
import {Choice} from "../models/Choice";
import {Course} from "../models/Course";
import {devlog} from "../utils/devlog";
import {
    getScrapeUrlChoice,
    getScrapeUrlForumMain,
    getScrapeUrlForumReports,
    getScrapeUrlForumSubscriptions,
    getScrapeUrlQuiz
} from "../utils/urlBuilder";
import {normalizeGradeTo10, parseLastAccess, parseRoles, parseViewsAndUsers} from "./dataProcessor";
import {Resource, URLResource, Workshop} from "../models/ActivityBase";

export class ProdDataExtractor implements IDataExtractor {

    protected async fetchAndParse(url: string): Promise<Document> {
        const response = await fetch(url);
        const html = await response.text();
        return new DOMParser().parseFromString(html, "text/html");
    }

    /**
     * Scrapes the total number of participants from the given participants URL.
     */
    async scrapeNumParticipants(participantsUrl: string): Promise<number | null> {
        const t0 = performance.now();
        devlog.info("dataExtractor", "scrapeNumParticipants:start", {participantsUrl});

        try {
            const doc = await this.fetchAndParse(participantsUrl);

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
     * Scrapes the list of participants from the given participants URL.
     */
    async scrapeParticipants(participantsUrl: string): Promise<Participant[]> {
        const t0 = performance.now();
        devlog.info("dataExtractor", "scrapeParticipants:start", {participantsUrl});

        try {
            const doc = await this.fetchAndParse(participantsUrl);

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
    async scrapeChoices(
        id: number,
        activityName: string,
        numViews: number,
        numUsers: number,
        lastAccess: number | undefined
    ): Promise<Choice[]> {
        const t0 = performance.now();
        devlog.info("dataExtractor", "scrapeChoices:start", {id, activityName, numViews, numUsers, lastAccess});

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
    async scrapeQuizzes(
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
            const doc = await this.fetchAndParse(url.quizResults);

            // ---------- Helpers ------------------------------------------------------

            // Locale-agnostic numeric parser: "10,00", "1.000,50", "1,000.50", "-0,25", "-0.25"
            const parseLocaleNumber = (raw: string | null | undefined): number | null => {
                if (!raw) return null;
                const s = raw.replace(/\u00A0/g, " ").trim();
                if (!s) return null;

                const neg = /^\s*-/.test(s);
                const body = s.replace(/[^0-9.,]/g, "");
                if (!body) return null;

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

            // Duration to ms, language-agnostic. Supports "HH:MM:SS", "MM:SS" or free text like "46 mins 32 secs".
            const parseDurationToMillis = (raw: string | null | undefined): number | undefined => {
                if (!raw) return undefined;
                const txt = raw.replace(/\u00A0/g, " ").trim();

                const colon = txt.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
                if (colon) {
                    const h = colon[3] !== undefined ? parseInt(colon[1], 10) : 0;
                    const m = colon[3] !== undefined ? parseInt(colon[2], 10) : parseInt(colon[1], 10);
                    const s = colon[3] !== undefined ? parseInt(colon[3], 10) : parseInt(colon[2], 10);
                    return ((h * 3600) + (m * 60) + s) * 1000;
                }

                const nums = (txt.match(/\d+/g) || []).map(n => parseInt(n, 10)).filter(Number.isFinite);
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

            // Get the numeric part of a "cX" class as an integer (e.g., "c8" -> 8). Returns -1 if missing.
            const colIndexFromClass = (el: Element | null): number => {
                if (!el) return -1;
                const cls = Array.from(el.classList).find(c => /^c\d+$/.test(c));
                return cls ? parseInt(cls.slice(1), 10) : -1;
            };

            // Find the result table by locating the "sumgrades" header and climbing up.
            const findResultsTable = (root: Document): HTMLTableElement | null => {
                const headerAnchor =
                    root.querySelector<HTMLAnchorElement>('a[data-sortby="sumgrades"]') ||
                    root.querySelector<HTMLAnchorElement>('a[href*="tsort=sumgrades"]');

                const table = headerAnchor?.closest("table") as HTMLTableElement | null;
                if (table) return table;

                // Fallback: find any table that contains attempt checkboxes.
                const candidates = Array.from(root.querySelectorAll<HTMLTableElement>("table"));
                return candidates.find(t => t.querySelector('input[name="attemptid[]"]')) || null;
            };

            // Extract max grade from the header anchor text (e.g., "Grade/1.00").
            const findMaxGrade = (root: Document): number => {
                const headerAnchor =
                    root.querySelector<HTMLAnchorElement>('a[data-sortby="sumgrades"]') ||
                    root.querySelector<HTMLAnchorElement>('a[href*="tsort=sumgrades"]');

                if (headerAnchor) {
                    const text = headerAnchor.textContent?.trim() ?? "";
                    const matches = text.match(/\d+(?:[.,]\d+)?/g);
                    if (matches && matches.length) {
                        const last = matches[matches.length - 1];
                        const parsed = parseLocaleNumber(last);
                        if (parsed && parsed > 0) return parsed;
                    }
                }
                // Conservative default if header not found; many sites use /10.
                return 10;
            };

            // ---------- Locate table & rows -----------------------------------------

            const tableResultsQuiz = findResultsTable(doc);
            if (!tableResultsQuiz) {
                const msNF = Math.round(performance.now() - t0);
                devlog.warn("dataExtractor", "scrapeQuizzes:results table not found", {durationMs: msNF});
                return [];
            }

            const maxGrade = findMaxGrade(doc);

            // Only rows with attempt checkbox are actual attempts.
            const rowsResultsQuiz = Array.from(tableResultsQuiz.querySelectorAll<HTMLTableRowElement>("tbody tr"))
                .filter(tr => tr.querySelector('input[name="attemptid[]"]'));

            const participantStats: QuizParticipantData[] = [];

            // Skip counters / diagnostics
            let skipEmptyRow = 0;
            let skipNoNameAnchor = 0;
            let skipNoId = 0;
            let skipNaNId = 0;
            let skipNoGrade = 0;

            for (const row of rowsResultsQuiz) {
                // Name cell: user anchor to /user/view.php
                const nameAnchor = row.querySelector<HTMLAnchorElement>('td a[href*="/user/view.php"]');
                if (!nameAnchor) {
                    skipNoNameAnchor++;
                    continue;
                }

                const participantName = (nameAnchor.textContent || "").trim();

                // Extract participant id from profile URL
                const idMatch = nameAnchor.getAttribute("href")?.match(/[?&]id=(\d+)/);
                if (!idMatch) {
                    skipNoId++;
                    continue;
                }

                const participantId = parseInt(idMatch[1], 10);
                if (Number.isNaN(participantId)) {
                    skipNaNId++;
                    continue;
                }

                // Grade anchor (stable across locales)
                const gradeAnchor = row.querySelector<HTMLAnchorElement>('td a[href*="/mod/quiz/review.php?attempt="]');
                if (!gradeAnchor) {
                    skipNoGrade++;
                    continue;
                }

                const gradeCell = gradeAnchor.closest("td") as HTMLTableCellElement | null;

                // Duration is typically at c(gradeCol-1). Use column classes to locate robustly.
                let durationMs: number | undefined = undefined;
                if (gradeCell) {
                    const gradeCol = colIndexFromClass(gradeCell);
                    const durationCell =
                        gradeCol > 1
                            ? row.querySelector<HTMLTableCellElement>(`.cell.c${gradeCol - 1}`)
                            : gradeCell.previousElementSibling instanceof HTMLTableCellElement
                                ? gradeCell.previousElementSibling
                                : null;

                    const rawDuration = durationCell?.textContent?.trim() ?? "";
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

                participantStats.push({
                    participantId,
                    participantName,
                    duration: durationMs,
                    grade: parsedGrade,
                    normalizedGrade,
                });
            }

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
            }, quiz);

            return quizzes;

        } catch (error) {
            const ms = Math.round(performance.now() - t0);
            devlog.error("dataExtractor", "scrapeQuizzes:error", {error: String(error), durationMs: ms});
            return [];
        }
    }

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

            const reportLink = doc.querySelector<HTMLAnchorElement>('a[href*="forumid="]');
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
     * Orchestrates the scraping of a full course, including its metadata
     * and all activities (participants, quizzes, forums, choices, etc.).
     */
    async scrapeCourse(
        courseId: string,
        courseMainUrl: string,
        activityReportUrl: string,
        participantsUrl: string,
        totalParticipants: number,
        progress?: AnalysisProgress
    ): Promise<Course> {
        const t0 = performance.now();
        devlog.info("dataExtractor", "scrapeCourse:start", {
            courseId,
            totalParticipants,
            urls: {courseMainUrl, activityReportUrl, participantsUrl},
        });

        try {
            // ---- PROGRESS: initialize & pre-scan ----
            progress?.start("status.initializing");
            progress?.setLabel("status.fetching_activity_report");

            const doc = await this.fetchAndParse(activityReportUrl);
            const table = doc.querySelector("table#outlinetable");
            const rows = Array.from(table?.querySelectorAll("tbody tr") ?? []);

            // Base steps: parse activity report (1) + scrape participants (1) + scrape course main (1)
            // + one step per activity row processed
            const dynamicTotal = 3 + rows.length;
            progress?.setTotal(dynamicTotal);
            progress?.tick(1);
            devlog.info("progress:tick", "activity_report_parsed", 1, dynamicTotal);

            // ---- PROGRESS: participants ----
            progress?.setLabel("status.scraping_participants");
            const participants = await this.scrapeParticipants(participantsUrl);
            progress?.tick(1);
            devlog.info("progress:tick", "participants_done", 2, dynamicTotal);

            const numParticipantsTotal = participants.length;

            // ---- PROGRESS: course main ----
            progress?.setLabel("status.scraping_course_main");
            const courseName = await this.scrapeCourseMain(courseMainUrl);
            progress?.tick(1);
            devlog.info("progress:tick", "course_main_done", 3, dynamicTotal);

            // ---- Prepare accumulators ----
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

            // ---- Iterate activities (1 tick per row processed) ----
            for (const row of rows) {
                const activityLink = row.querySelector<HTMLAnchorElement>(
                    'td.activityname a[href], td.activity a[href], td a[href*="/mod/"]'
                );
                if (!activityLink) {
                    progress?.tick(1);
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
                    progress?.tick(1);
                    continue;
                }
                const id = parseInt(idMatch[1], 10);

                try {
                    switch (true) {
                        case href.includes("/mod/url/"): {
                            progress?.setLabel("status.scraping_url");
                            urlResources.push({activityName, numViews, numUsers, lastAccess});
                            typeCounts.url++;
                            break;
                        }

                        case href.includes("/mod/workshop/"): {
                            progress?.setLabel("status.scraping_workshop");
                            workshops.push({activityName, numViews, numUsers, lastAccess});
                            typeCounts.workshop++;
                            break;
                        }

                        case href.includes("/mod/resource/"): {
                            progress?.setLabel("status.scraping_resource");
                            resources.push({activityName, numViews, numUsers, lastAccess});
                            typeCounts.resource++;
                            break;
                        }

                        case href.includes("/mod/choice/"): {
                            progress?.setLabel("status.scraping_choice");
                            const choiceResults = await this.scrapeChoices(
                                id,
                                activityName,
                                numViews,
                                numUsers,
                                lastAccess
                            );
                            choices.push(...choiceResults);
                            typeCounts.choice += choiceResults.length;
                            break;
                        }

                        case href.includes("/mod/quiz/"): {
                            progress?.setLabel("status.scraping_quiz");
                            const quizResults = await this.scrapeQuizzes(
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
                            progress?.setLabel("status.scraping_forum");
                            const forumResults = await this.scrapeForums(
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

                        default: {
                            progress?.setLabel("status.scraping_other");
                            break;
                        }
                    }
                } finally {
                    progress?.tick(1);
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

            // ---- PROGRESS: complete ----
            progress?.setLabel("status.complete");
            progress?.complete();

            return course;
        } catch (error) {
            const ms = Math.round(performance.now() - t0);
            devlog.error("dataExtractor", "scrapeCourse:error", {error: String(error), durationMs: ms});
            throw error;
        }
    }
}
