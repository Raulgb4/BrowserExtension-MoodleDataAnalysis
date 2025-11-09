/**
 * @file dataExtractorProd.ts
 * @description Production implementation of IDataExtractor for Moodle UMA.
 * Contains scraping logic adapted to the DOM of the official Moodle environment.
 *
 * @author
 * Raúl García Balongo
 * @date 2025
 */

import {AbstractDataExtractor, AnalysisProgress, GraderReportData} from "./AbstractDataExtractor";

// Models
import {Participant} from "../models/Participant";
import {Quiz, QuizParticipantData} from "../models/Quiz";
import {Forum} from "../models/Forum";
import {Choice} from "../models/Choice";
import {Course} from "../models/Course";
import {devlog} from "../utils/devlog";
import {getScrapeUrlGraderReport, getScrapeUrlQuiz} from "../utils/urlBuilder";
import {
    normalizeGradeTo10,
    normalizeTimeToMillis,
    parseLastAccess,
    parseRoles,
    parseViewsAndUsers
} from "./dataProcessor";
import {Resource, URLResource} from "../models/ActivityBase";
import {Assignment} from "../models/Assignment";
import {Workshop} from "../models/Workshop";

export class ProdDataExtractor extends AbstractDataExtractor {

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
    async scrapeParticipants(participantsUrl: string, courseId: string): Promise<Participant[]> {
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

                // TO MODIFY
                //const urlGradeOverview = getScrapeUrlParticipantsGradesOverview(id, courseId);
                //const docGradeOverview = await this.fetchAndParse(urlGradeOverview.participantsGradesOverview);


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
     * Scrapes all Quiz activities within a course (adapted to Campus Virtual HTML).
     * - Header cells use data-sortby (lastname/firstname/duration/sumgrades)
     * - Rows with actual attempts to have: input[name="attempted[]"]
     * - Name is in td.c2 (anchor to /user/view.php)
     * - Duration is in td.c6 (Spanish text like "47 días 16 horas" or "15 min 32 s")
     * - Grade is in td.c7 (anchor to review; comma decimal like "7,25")
     */
    /**
     * Scrapes all Quiz activities within a course (adapted to Campus Virtual HTML).
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

            const parseLocaleNumber = (raw?: string | null): number | null => {
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
                return Number.isFinite(n) ? (neg ? -n : n) : null;
            };

            const headerSum = doc.querySelector<HTMLAnchorElement>('a[data-sortby="sumgrades"]');
            const tableResultsQuiz =
                (headerSum?.closest("table") as HTMLTableElement | null) ||
                doc.querySelector<HTMLTableElement>("table#attempts"); // fallback local

            const rowsResultsQuiz = Array.from(tableResultsQuiz?.querySelectorAll<HTMLTableRowElement>("tbody tr") ?? [])
                .filter(tr => tr.querySelector('input[name="attemptid[]"]')); // solo intentos reales

            if (!tableResultsQuiz || rowsResultsQuiz.length === 0) {
                const msNF = Math.round(performance.now() - t0);
                devlog.warn("dataExtractor", "scrapeQuizzes:no quiz results table or empty", {
                    id, activityName, durationMs: msNF,
                });
                return [];
            }

            const maxGradeText = headerSum?.textContent?.trim() ?? "";
            const maxGradeNums = maxGradeText.match(/\d+(?:[.,]\d+)?/g);
            const lastNumStr = (maxGradeNums && maxGradeNums.length > 0)
                ? maxGradeNums[maxGradeNums.length - 1]
                : "10";
            const maxGrade = parseLocaleNumber(lastNumStr) ?? 10;

            const participantStats: QuizParticipantData[] = [];
            let skippedNoName = 0, skippedNoId = 0, skippedNoGrade = 0;

            for (const row of rowsResultsQuiz) {
                const nameCell = row.querySelector<HTMLTableCellElement>("td.cell.c2");
                const nameAnchor = nameCell?.querySelector<HTMLAnchorElement>('a[href*="/user/view.php"]');
                if (!nameAnchor) {
                    skippedNoName++;
                    continue;
                }

                const participantName = (nameAnchor.textContent || "").trim();
                const idMatch = nameAnchor.getAttribute("href")?.match(/[?&]id=(\d+)/);
                if (!idMatch) {
                    skippedNoId++;
                    continue;
                }
                const participantId = parseInt(idMatch[1], 10);
                if (!Number.isFinite(participantId)) {
                    skippedNoId++;
                    continue;
                }

                const rawDuration = row.querySelector<HTMLTableCellElement>("td.cell.c6")?.textContent ?? "";
                const duration = normalizeTimeToMillis(rawDuration);

                const gradeCell = row.querySelector<HTMLTableCellElement>("td.cell.c7");
                const gradeAnchor = gradeCell?.querySelector<HTMLAnchorElement>("a");
                const gradeRaw = (gradeAnchor?.textContent ?? gradeCell?.textContent ?? "").trim();
                const gradeParsed = parseLocaleNumber(gradeRaw);
                if (!Number.isFinite(gradeParsed)) {
                    skippedNoGrade++;
                    continue;
                }
                const grade = gradeParsed as number;

                const normalizedGrade = normalizeGradeTo10(grade, maxGrade);

                participantStats.push({
                    participantId,
                    participantName,
                    duration,
                    grade,
                    normalizedGrade,
                });
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
                skipped: {noName: skippedNoName, noId: skippedNoId, noGrade: skippedNoGrade},
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
     * Scrapea la página del Grader Report (UMA)
     */
    private async scrapeGraderReport(courseId: string | number): Promise<GraderReportData> {
        const url = getScrapeUrlGraderReport(courseId);
        const doc = await this.fetchAndParse(url.graderReport);

        const table = doc.querySelector('table.gradereport-grader-table#user-grades');
        if (!table) {
            devlog.warn("grader_report", "table_not_found", {courseId});
            return {
                finalGradesByPid: new Map(),
                workshopGradesByWid: new Map(),
                assignmentGradesByAid: new Map(),
            };
        }

        // --- 1) Mapear columnas por data-itemid ---
        type ColType = "workshop" | "assignment" | "final";
        const colMeta = new Map<number, { type: ColType; activityId?: number }>();
        let finalItemId: number | null = null;

        // En UMA, el header principal viene en <tr class="heading">
        const headerRow =
            table.querySelector('tr.heading') ??
            table.querySelector('thead tr') ??
            null;

        if (headerRow) {
            // Columns relevantes tienen data-itemid; incluye tanto actividades como el total de curso (courseitem)
            const ths = headerRow.querySelectorAll<HTMLTableCellElement>('th[data-itemid]');
            ths.forEach((th) => {
                const itemId = Number(th.getAttribute('data-itemid'));
                if (!Number.isFinite(itemId)) return;

                // 1. Detectar "Course total" (nota final del curso)
                const labelEl = th.querySelector('.gradeitemheader'); // puede ser <span> o <a>
                const labelText = labelEl?.textContent?.trim().toLowerCase() ?? '';
                const isCourseTotal =
                    th.classList.contains('courseitem') ||
                    labelText.includes('course total');

                if (isCourseTotal) {
                    colMeta.set(itemId, {type: "final"});
                    finalItemId = itemId;
                    return;
                }

                // 2. Detectar tipo de actividad por el href cuando exista
                const link = th.querySelector<HTMLAnchorElement>('a.gradeitemheader');
                const href = link?.getAttribute('href') || '';

                let type: ColType | null = null;
                if (href.includes('/mod/workshop/')) type = "workshop";
                else if (href.includes('/mod/assign/')) type = "assignment";

                // Extraer id de actividad si hay href
                let activityId: number | undefined;
                if (type && href) {
                    const m = href.match(/id=(\d+)/);
                    const idNum = Number(m?.[1] ?? NaN);
                    if (Number.isFinite(idNum)) activityId = idNum;
                }

                // Registrar solo si pudimos inferir tipo (y, si aplica, activityId)
                if (type) {
                    colMeta.set(itemId, {type, activityId});
                }
            });
        }

        // --- 2) Estructuras de salida ---
        const finalGradesByPid = new Map<number, number>();
        const workshopGradesByWid = new Map<number, Map<number, number>>();
        const assignmentGradesByAid = new Map<number, Map<number, number>>();
        const finalGradesRaw: Array<{ pid: number; value: number }> = [];

        // --- 3) Recorremos filas de usuarios ---
        const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr.userrow');
        rows.forEach((row) => {
            const pid = Number(row.getAttribute('data-uid'));
            if (!Number.isFinite(pid)) return;

            // Celdas de nota: td.grade ... con data-itemid
            const cells = row.querySelectorAll<HTMLTableCellElement>('td.grade[data-itemid]');
            cells.forEach((td) => {
                const itemId = Number(td.getAttribute('data-itemid'));
                if (!Number.isFinite(itemId)) return;

                const meta = colMeta.get(itemId);
                if (!meta) return; // columna no interesada / no mapeada

                // Valor de la celda
                const gv = td.querySelector<HTMLElement>('.gradevalue');
                const raw = gv?.textContent?.trim() ?? '';
                // Ignorar "-" y notas “apagadas” (sin calificación)
                if (!raw || raw === '-' || gv?.classList.contains('dimmed_text')) return;

                // Convertir a número (admite coma decimal)
                const parsed = parseFloat(raw.replace(',', '.'));
                if (!Number.isFinite(parsed)) return;

                // UMA parece usar escala sobre 10. Mantenemos normalización como hook.
                const normalized = parsed;

                if (meta.type === 'final') {
                    // En lugar de guardar ya en el Map, acumulamos crudo
                    finalGradesRaw.push({pid, value: normalized});
                    return;
                }

                if (meta.type === 'workshop' && Number.isFinite(meta.activityId!)) {
                    const wid = meta.activityId!;
                    const byPid = workshopGradesByWid.get(wid) ?? new Map<number, number>();
                    byPid.set(pid, normalized);
                    workshopGradesByWid.set(wid, byPid);
                    return;
                }

                if (meta.type === 'assignment' && Number.isFinite(meta.activityId!)) {
                    const aid = meta.activityId!;
                    const byPid = assignmentGradesByAid.get(aid) ?? new Map<number, number>();
                    byPid.set(pid, normalized);
                    assignmentGradesByAid.set(aid, byPid);
                    return;
                }
            });
        });

        // --- Post-proceso de escala para la nota final ---
        // Regla: si alguna nota final supera 10 de forma clara, asumimos escala 0–100 y convertimos a 0–10.
        if (finalGradesRaw.length > 0) {
            const maxFinal = Math.max(...finalGradesRaw.map(x => x.value));
            const needsDivideBy10 = maxFinal > 10.0001 && maxFinal <= 100.0001;

            for (const { pid, value } of finalGradesRaw) {
                const normalizedTo10 = needsDivideBy10 ? value / 10 : value;
                // Redondeo a dos decimales y clamp opcional a [0, 10]
                const rounded = Math.min(10, Math.max(0, Number(normalizedTo10.toFixed(2))));
                finalGradesByPid.set(pid, rounded);
            }
        }

        return {
            finalGradesByPid,
            workshopGradesByWid,
            assignmentGradesByAid,
        };
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
            const participants = await this.scrapeParticipants(participantsUrl, courseId);
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
            const assignments: Assignment[] = [];
            const resources: Resource[] = [];
            let quizzes: Quiz[] = [];
            let forums: Forum[] = [];

            const typeCounts = {
                url: 0,
                workshop: 0,
                assignment: 0,
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
                            urlResources.push({id, activityName, numViews, numUsers, lastAccess});
                            typeCounts.url++;
                            break;
                        }

                        case href.includes("/mod/workshop/"): {
                            progress?.setLabel("status.scraping_workshop");
                            workshops.push({id, activityName, numViews, numUsers, lastAccess});
                            typeCounts.workshop++;
                            break;
                        }

                        case href.includes("/mod/assign/"): {
                            progress?.setLabel("status.scraping_assignment");
                            assignments.push({id, activityName, numViews, numUsers, lastAccess});
                            typeCounts.workshop++;
                            break;
                        }

                        case href.includes("/mod/resource/"): {
                            progress?.setLabel("status.scraping_resource");
                            resources.push({id, activityName, numViews, numUsers, lastAccess});
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

            // 1) Recopilar datos crudos del Grader Report
            try {
                const graderData = await this.scrapeGraderReport(courseId);
                this.enrichFromGraderReport({
                    participants,
                    workshops,
                    assignments,
                    graderData,
                });
            } catch (err) {
                // Si falla el GR, no tiramos el scrape: lo registramos y seguimos con los datos base
                devlog.warn("dataExtractor", "grader_report:skipped_or_failed", {error: String(err), courseId});
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
                assignments,
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
                        assignments: assignments.length,
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
