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
import {Assignment, AssignmentParticipantData} from "../models/Assignment";
import {Workshop} from "../models/Workshop";

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
 * Estructura base con los datos del Grader Report
 * (rellenaremos las Maps más adelante)
 */
export interface GraderReportData {
    finalGradesByPid: Map<number, number>;
    workshopGradesByWid: Map<number, Map<number, number>>;
    assignmentGradesByAid: Map<number, Map<number, number>>;
}



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
            { id, activityName, numViews, numUsers, lastAccess });

        const normalize = (s?: string) =>
            (s ?? "")
                .trim()
                .toLowerCase()
                .normalize("NFD")
                .replace(/\p{Diacritic}/gu, "");

        try {
            const choices: Choice[] = [];
            const url = getScrapeUrlChoice(id);
            const doc = await this.fetchAndParse(url.choiceResults);

            const table = doc.querySelector('table.results.names');
            if (!table) {
                devlog.warn("dataExtractor", "scrapeChoices:table_not_found", { id, activityName });
                return [];
            }

            // --- 1) Cabeceras: etiquetas de opciones ---
            const responseCounts: Record<string, number> = {};
            const headerCells = table.querySelectorAll('thead tr th');
            const labelCells = Array.from(headerCells)
                .slice(1) // saltar la cabecera de fila ("Choice options")
                .map(th => {
                    // En Moodle típico, el texto visible está en el primer textNode dentro de .text-center
                    const txt =
                        th.querySelector('div.text-center')?.childNodes?.[0]?.textContent ??
                        th.textContent;
                    return txt?.trim();
                })
                .filter((label): label is string => !!label);

            // --- 2) Body: fila "Number of responses" -> responseCounts ---
            const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
            const numberRow = bodyRows.find(tr => {
                const th = tr.querySelector('th');
                const key = normalize(th?.textContent || "");
                // EN y ES (y variantes)
                return key.includes("number of responses") || key.includes("numero de respuestas");
            });

            if (numberRow) {
                const tds = Array.from(numberRow.querySelectorAll('td'));
                for (let i = 0; i < Math.min(labelCells.length, tds.length); i++) {
                    const label = labelCells[i];
                    const raw = tds[i]?.textContent?.trim() ?? "0";
                    const value = parseInt(raw, 10);
                    responseCounts[label] = Number.isFinite(value) ? value : 0;
                }
            } else {
                devlog.warn("dataExtractor", "scrapeChoices:number_row_not_found", { id, activityName });
            }

            // --- 3) Body: fila "Users who chose this option" -> participantStats ---
            // En inglés suele ser esa cadena; en ES algo como "Usuarios que eligieron esta opción".
            // Además, Moodle marca esa fila como .lastrow: lo usamos como fallback.
            let usersRow =
                bodyRows.find(tr => {
                    const th = tr.querySelector('th');
                    const key = normalize(th?.textContent || "");
                    return key.includes("users who chose this option") ||
                        key.includes("usuarios que eligieron esta opcion");
                }) ?? table.querySelector('tbody tr.lastrow') as HTMLTableRowElement | null;

            const participantsMap = new Map<number, string>();

            if (usersRow) {
                const tds = Array.from(usersRow.querySelectorAll('td'));
                // Recorremos por columnas (una columna por opción). No nos importa qué opción eligieron:
                // queremos el conjunto de alumnos que han votado en la Choice.
                for (let i = 0; i < tds.length; i++) {
                    const td = tds[i];
                    // Cada alumno aparece como <a href=".../user/view.php?id=XXX&course=Y">Nombre Apellidos</a>
                    const links = Array.from(td.querySelectorAll('a[href*="user/view.php"]'));
                    for (const a of links) {
                        const href = a.getAttribute('href') ?? "";
                        let pid: number | null = null;
                        try {
                            const urlObj = new URL(href, "http://dummy.local"); // base para URLs relativas
                            const idParam = urlObj.searchParams.get("id");
                            if (idParam) {
                                const parsed = parseInt(idParam, 10);
                                if (Number.isFinite(parsed)) pid = parsed;
                            }
                        } catch {
                            // Si falla el parseo (URL relativa sin base), intentamos regex como fallback
                            const m = href.match(/[?&]id=(\d+)/);
                            if (m) pid = parseInt(m[1], 10);
                        }
                        if (pid == null) continue;

                        // Nombre visible; si no, fallback al label "accesshide"
                        const nameText =
                            a.textContent?.trim() ||
                            a.getAttribute("aria-label")?.trim() ||
                            a.getAttribute("title")?.trim() ||
                            // Fallback adicional: el <label.accesshide> cercano
                            (a.parentElement?.querySelector("label.accesshide")?.textContent?.trim() ?? "");

                        if (nameText) {
                            // Deduplicamos por participantId
                            if (!participantsMap.has(pid)) {
                                participantsMap.set(pid, nameText);
                            }
                        }
                    }
                }
            } else {
                devlog.warn("dataExtractor", "scrapeChoices:users_row_not_found", { id, activityName });
            }

            const participantStats = Array.from(participantsMap.entries()).map(([participantId, participantName]) => ({
                participantId,
                participantName,
            }));

            // --- 4) Construir Choice y devolver ---
            const choice: Choice = {
                id,
                activityName,
                numViews,
                numUsers,
                lastAccess,
                responseCounts,
                participantStats,
            };

            const ms = Math.round(performance.now() - t0);
            devlog.info("dataExtractor", "scrapeChoices:success", { id, activityName, durationMs: ms }, choice);
            return [choice];

        } catch (error) {
            const ms = Math.round(performance.now() - t0);
            devlog.error("dataExtractor", "scrapeChoices:error", { error: String(error), durationMs: ms });
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

    /*
    abstract scrapeWorkshops(
        id: number,
        activityName: string,
        numViews: number,
        numUsers: number,
        lastAccess: number | undefined,
        courseId: string
    ): Promise<Workshop[]>;
     */

    /*
    async scrapeAssignments(
        id: number,
        activityName: string,
        numViews: number,
        numUsers: number,
        lastAccess: number | undefined,
        courseId: string
    ): Promise<Assignment[]>;
    */

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
     * Fusiona los datos del Grader Report con los ya scrapeados del curso.
     */
    protected enrichFromGraderReport(args: {
        participants: Participant[];
        workshops: Workshop[];
        assignments: Assignment[];
        graderData: GraderReportData;
    }): void {
        const { participants, workshops, assignments, graderData } = args;

        // Índices O(1) para lookup
        const nameByPid = new Map<number, string>();
        for (const p of participants) {
            nameByPid.set(p.id, p.participantName ?? p.email ?? String(p.id));
        }

        // 1) Final grade por participante
        if (graderData.finalGradesByPid?.size) {
            for (const p of participants) {
                const g = graderData.finalGradesByPid.get(p.id);
                if (Number.isFinite(g as number)) {
                    p.finalGrade = g as number;
                }
            }
        }

        // Helper genérico para volcar mapas (aid/wid -> (pid -> grade)) en participantStats[]
        function fillParticipantStatsForActivities<T extends { id: number; participantStats?: AssignmentParticipantData[] }>(
            activities: T[],
            gradesByActivity: Map<number, Map<number, number>>
        ) {
            if (!gradesByActivity?.size || !activities?.length) return;

            // Índice de actividad por id para no hacer .find() repetidos
            const byId = new Map<number, T>();
            for (const a of activities) byId.set(a.id, a);

            for (const [activityId, gradesByPid] of gradesByActivity.entries()) {
                const activity = byId.get(activityId);
                if (!activity) continue;

                const stats: AssignmentParticipantData[] = [];
                for (const [pid, grade] of gradesByPid.entries()) {
                    if (!Number.isFinite(grade)) continue;
                    stats.push({
                        participantId: pid,
                        participantName: nameByPid.get(pid) ?? String(pid),
                        grade,
                    });
                }

                // Opcional: ordenar de mayor a menor (comenta si no lo quieres)
                stats.sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0));

                activity.participantStats = stats;
            }
        }

        // 2) Workshops → participantStats
        fillParticipantStatsForActivities(workshops, graderData.workshopGradesByWid);

        // 3) Assignments → participantStats
        fillParticipantStatsForActivities(assignments, graderData.assignmentGradesByAid);
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
