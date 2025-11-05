/**
 * @file dataExtractorLocal.ts
 * @description Local (Docker) implementation of IDataExtractor for Moodle.
 * Contains scraping logic adapted to the DOM of the Moodle Docker environment.
 *
 * @note This class mirrors ProdDataExtractor but with differences in selectors
 *       or parsing logic that depend on the local DOM structure.
 *
 * @author
 * Raúl García Balongo
 * @date 2025
 */

// Models
import {Participant} from "../models/Participant";
import {Quiz, QuizParticipantData} from "../models/Quiz";
import {Forum} from "../models/Forum";
import {Choice} from "../models/Choice";
import {Course} from "../models/Course";
import {devlog} from "../utils/devlog";
import {
    normalizeGradeTo10,
    normalizeTimeToMillis,
    parseLastAccess,
    parseRoles,
    parseViewsAndUsers
} from "./dataProcessor";
import {Resource, URLResource, Workshop} from "../models/ActivityBase";
import {AbstractDataExtractor, AnalysisProgress} from "./AbstractDataExtractor";
import {getScrapeUrlQuiz} from "../utils/urlBuilder";

export class LocalDataExtractor extends AbstractDataExtractor {

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
        devlog.info("dataExtractor", "scrapeNumParticipantsLocal:start", {participantsUrl});

        try {
            const doc = await this.fetchAndParse(participantsUrl);

            // Helper: get largest integer from a visible text string (tolerates 1.234 / 1,234 / 1234).
            const extractLargestInteger = (text?: string | null): number | null => {
                if (!text) return null;
                const matches = text.match(/(\d{1,3}(?:[.,\s]\d{3})*|\d+)/g);
                if (!matches) return null;

                const nums = matches
                    .map(s => parseInt(s.replace(/[.,\s]/g, ""), 10))
                    .filter(n => Number.isFinite(n));

                return nums.length ? Math.max(...nums) : null;
            };

            let total: number | null = null;

            const totalRowsAttr = doc
                .querySelector<HTMLElement>('[data-region="core_table/dynamic"]')
                ?.getAttribute("data-table-total-rows");
            if (totalRowsAttr) {
                const n = parseInt(totalRowsAttr, 10);
                if (Number.isFinite(n)) total = n;
            }

            // 1) “Show all N” anchor: aria-label suele venir como "Showall" (no localizado) o data-action agnóstico.
            if (total === null) {
                const showAllAnchor =
                    doc.querySelector<HTMLAnchorElement>("a[aria-label='Showall']") ||
                    doc.querySelector<HTMLAnchorElement>("a.page-link[data-action='showalllink']");
                total = extractLargestInteger(showAllAnchor?.textContent?.trim() ?? "");
            }

            // 2) Fallback: contenedor contador (solo leemos dígitos → independiente de idioma).
            if (total === null) {
                const counterEl =
                    doc.querySelector<HTMLElement>(".participantes_mostrados span") ||
                    doc.querySelector<HTMLElement>(".participants-count, .participants_counter span");
                total = extractLargestInteger(counterEl?.textContent?.trim() ?? "");
            }

            // 3) Fallback: ARIA rowcount en la tabla o grid si el tema lo expone.
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
                devlog.error("dataExtractor", "scrapeNumParticipantsLocal:not found", {durationMs: ms});
                return null;
            }

            devlog.info("dataExtractor", "scrapeNumParticipantsLocal:success", {total, durationMs: ms});
            return total;
        } catch (error) {
            const ms = Math.round(performance.now() - t0);
            devlog.error("dataExtractor", "scrapeNumParticipantsLocal:error", {
                error: String(error),
                durationMs: ms,
            });
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


            const dynamicRegion =
                doc.querySelector<HTMLElement>('[data-region="core_table/dynamic"]');
            const table =
                doc.querySelector<HTMLTableElement>("#participants") ||
                dynamicRegion?.querySelector("table") ||
                doc.querySelector<HTMLTableElement>('table[data-region="core_table/dynamic"]');

            if (!table && !dynamicRegion) {
                const ms = Math.round(performance.now() - t0);
                devlog.error("dataExtractor", "scrapeParticipants:participants table not found",
                    {durationMs: ms});
                return [];
            }

            const rows = Array.from(
                (table ?? dynamicRegion)?.querySelectorAll("tbody tr") ?? []
            );

            const participants: Participant[] = [];

            // Safe access to optional parsers; provide fallbacks to avoid TS2304 and keep behavior predictable.
            const fallbackParseGroups = (raw?: string | null) => {
                if (!raw) return undefined;
                const arr = raw.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
                return arr.length ? arr : undefined;
            };


            const parseGroupsFn: (s?: string | null) => any =
                (globalThis as any).parseGroups ?? fallbackParseGroups;


            for (const row of rows) {
                // --- NAME / PROFILE LINK ---
                // Try common local cells: th.cell.c1 (local) or th.cell.c2 (alt), then anchor to the user profile.
                const nameCell =
                    row.querySelector<HTMLElement>("th.cell.c1") ||
                    row.querySelector<HTMLElement>("th.cell.c2") ||
                    row.querySelector<HTMLElement>("th[scope='row']");

                const profileLink =
                    nameCell?.querySelector<HTMLAnchorElement>('a[href*="/user/view.php"]') ||
                    nameCell?.querySelector<HTMLAnchorElement>("a");

                if (!profileLink) continue;

                // Prefer visible text node; fallback to full textContent.
                const textNode =
                    Array.from(profileLink.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
                const rawName = (textNode?.textContent ?? profileLink.textContent ?? "").trim();
                const participantName = rawName.replace(/\s+/g, " ");
                if (!participantName || participantName === "-") continue;

                // Extract numeric user id from href (?|&)id=123
                const href = profileLink.getAttribute("href") ?? "";
                const idMatch = href.match(/[?&]id=(\d+)/);
                if (!idMatch) continue;
                const id = parseInt(idMatch[1], 10);
                if (!Number.isFinite(id)) continue;

                // --- CELLS FAST-PATH (local layouts often map columns predictably) ---
                const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));

                // Email:
                //  - Local table often has it at cells[1], but also try a specific anchor class if present.
                const emailFromCell = cells[1]?.textContent?.trim() ?? "";
                const emailFromAnchor =
                    nameCell?.querySelector<HTMLAnchorElement>
                    ("a.correo_lista_participantes")?.textContent?.trim() ?? "";
                const email = (emailFromAnchor || emailFromCell).replace(/\s+/g, " ");

                // Roles:
                //  - Try class-based lookup first (td.cell.c3), then fallback to positional cell (cells[2]).
                const rolesRaw =
                    row.querySelector<HTMLElement>("td.cell.c3")?.innerText?.trim() ??
                    cells[2]?.innerText?.trim();
                const roles = parseRoles(rolesRaw);

                // Groups (local often has it at cells[3]); keep if your Participant type supports it.
                const groupsRaw =
                    row.querySelector<HTMLElement>("td.cell.c3.groups, td.groups")?.innerText?.trim() ??
                    cells[3]?.innerText?.trim();
                const groups = parseGroupsFn(groupsRaw);

                // lastAccessToCourse (optional, mirrors "official" shape if you use it elsewhere)
                const lastAccessRaw =
                    row.querySelector<HTMLElement>("td.cell.c5")?.innerText?.trim();
                const lastAccessToCourse = parseLastAccess(lastAccessRaw);

                const participant: Participant = {
                    id,
                    participantName,
                    email,
                    roles,
                    lastAccessToCourse,
                    // The following fields are included only if your Participant type defines them:
                    ...(typeof groups !== "undefined" ? {groups} : {}),
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
            devlog.error("dataExtractor", "scrapeParticipants:error",
                {error: String(error), durationMs: ms});
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

            const gradeHeaderAnchor = doc.querySelector('a[aria-label^="Sort by Grade/"]');
            const gradeHeaderText = gradeHeaderAnchor?.textContent?.trim() ?? "";
            const maxGradeMatch = gradeHeaderText.match(/Grade\/([\d.]+)/);
            const maxGrade = parseFloat(maxGradeMatch?.[1] ?? "1");

            const tableResultsQuiz = doc.querySelector("table#attempts");
            const rowsResultsQuiz = Array.from(tableResultsQuiz?.querySelectorAll("tbody tr") ?? []);

            if (!tableResultsQuiz || rowsResultsQuiz.length === 0) {
                const msNF = Math.round(performance.now() - t0);
                devlog.warn("dataExtractor", "scrapeQuizzes:no quiz results table or empty", {
                    id,
                    activityName,
                    durationMs: msNF,
                });
                return [];
            }

            const participantStats: QuizParticipantData[] = [];

            for (const rowQuiz of rowsResultsQuiz) {
                const rowClass = rowQuiz.className.trim().toLowerCase();
                if (rowClass.includes("emptyrow") || rowClass.includes("empty row")) continue;

                const nameCell = rowQuiz.querySelector("td.cell.c2");
                const nameText = nameCell?.textContent?.trim().toLowerCase() ?? "";
                if (!nameText || nameText.includes("overall average")) continue;

                const nameAnchor = nameCell?.querySelector("a");
                const participantName = nameAnchor?.textContent?.trim() ?? "";

                const idMatch = nameAnchor?.getAttribute("href")?.match(/id=(\d+)/);
                if (!idMatch) continue;
                const participantId = parseInt(idMatch[1], 10);

                const rawDuration = rowQuiz.querySelector("td.cell.c7")?.textContent?.trim() ?? "";
                const duration = normalizeTimeToMillis(rawDuration);

                const gradeText = rowQuiz.querySelector("td.cell.c8 a")?.textContent?.trim() ?? "";
                const grade = parseFloat(gradeText);
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
            const table = doc.querySelector('table#outlinereport');
            const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []);

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

                const activityCell = row.querySelector('td.activityname');
                const viewsCell = row.querySelector("td.numviews");
                const lastAccessCell = row.querySelector("td.lastaccess");
                const anchor = activityCell?.querySelector('a');
                if (!anchor) continue;

                const href = anchor?.getAttribute('href') ?? '';
                const activityName = anchor?.textContent?.trim() ?? '';
                const {numViews, numUsers} = parseViewsAndUsers(viewsCell?.textContent?.trim() ?? '');

                const durationMatch = lastAccessCell?.textContent?.match(/\(([^)]+)\)/);
                const relativeDuration = durationMatch?.[1]?.trim();
                const lastAccess = parseLastAccess(relativeDuration);

                const idMatch = href.match(/id=(\d+)/);
                if (!idMatch) {
                    progress?.tick(1);
                    continue;
                }
                const id = parseInt(idMatch[1]);

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
