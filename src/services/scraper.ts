/**
 * @file scraper.ts
 * @description Centralized module for scraping various Moodle course sections,
 * including participants, quizzes, resources, and forum data.
 *
 * @author Raúl García Balongo
 * @date 2025
 */
import {Participant} from '../models/Participant';
import {Choice, URLResource, Workshop, Resource} from "../models/ActivityBase";
import {Quiz, QuizParticipantData} from "../models/Quiz";
import {Forum, ForumParticipantData} from "../models/Forum";
import {
    getScrapeUrlQuiz,
    getScrapeUrlForumMain,
    getScrapeUrlForumReports,
    getScrapeUrlForumSubscriptions
} from "../utils/urlBuilder";
import {Course} from "../models/Course";


/**
 * Normalizes a duration string like "5 days 13 hours" or "46 mins 32 secs"
 * into a standard format: "dd hh:mm:ss".
 *
 * @param input - The raw duration string from Moodle
 * @returns A normalized duration string or empty string if input is "Never"
 */
export function normalizeDuration(input: string): string {
    if (input.trim().toLowerCase() === 'never') return '';

    const daysMatch = input.match(/(\d+)\s*days?/);
    const hoursMatch = input.match(/(\d+)\s*hours?/);
    const minsMatch = input.match(/(\d+)\s*mins?/);
    const secsMatch = input.match(/(\d+)\s*secs?/);
    const oneDayMatch = input.match(/1\s*day/);
    const oneHourMatch = input.match(/1\s*hour/);
    const oneMinMatch = input.match(/1\s*min/);
    const oneSecMatch = input.match(/1\s*sec/);

    const days = daysMatch ? parseInt(daysMatch[1]) : (oneDayMatch ? 1 : 0);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : (oneHourMatch ? 1 : 0);
    const mins = minsMatch ? parseInt(minsMatch[1]) : (oneMinMatch ? 1 : 0);
    const secs = secsMatch ? parseInt(secsMatch[1]) : (oneSecMatch ? 1 : 0);

    const dd = String(days).padStart(2, '0');
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');

    return `${dd} ${hh}:${mm}:${ss}`;
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
 * Scrapes the total number of participants enrolled in a Moodle course from the participant page.
 *
 * This asynchronous function performs an HTTP `fetch` request to the provided `participantsUrl`,
 * which should point to the participants listing page of a Moodle course (e.g., `/user/index.php?id=COURSE_ID`).
 *
 * It retrieves the HTML content of the page and uses the `DOMParser` to parse it into a `Document` object.
 * The function then searches for the HTML table element responsible for displaying the dynamic list of participants.
 * This table contains a special attribute called `data-table-total-rows`, which represents the total number of enrolled users.
 *
 * If this attribute is found and correctly parsed into a valid integer, the function returns it as the total number of participants.
 * If the attribute is missing or invalid, or if any error occurs during fetching or parsing, the function returns `null`.
 *
 * This scraping logic is used to dynamically determine pagination sizes and resource limits for later
 * data scraping tasks, such as retrieving all participants, forums, or quiz results.
 *
 * @param participantsUrl - The full URL to the Moodle participants page of a specific course.
 *                          Example: 'http://localhost:8080/user/index.php?id=2'
 *
 * @returns A `Promise` that resolves to:
 *          - A `number` representing the total number of participants, if successfully extracted.
 *          - `null` if the total could not be determined due to missing attributes or unexpected errors.
 *
 * @example
 * const total = await scrapeTotalParticipants("http://localhost:8080/user/index.php?id=2");
 * if (total !== null) {
 *   console.log("Total participants:", total);
 * } else {
 *   console.warn("Unable to extract participant count.");
 * }
 */
export async function scrapeNumParticipants(participantsUrl: string): Promise<number | null> {
    try {
        const doc = await fetchAndParse(participantsUrl);

        const dynamicTable = doc.querySelector('[data-region="core_table/dynamic"]');
        const totalRows = dynamicTable?.getAttribute("data-table-total-rows");

        if (totalRows) {
            const parsed = parseInt(totalRows, 10);
            return isNaN(parsed) ? null : parsed;
        }

        return null;
    } catch (error) {
        console.error("Error scraping total participants:", error);
        return null;
    }
}

/**
 * Scrapes the participant table from a given Moodle participants page URL,
 * extracting relevant information for each user enrolled in the course.
 *
 * This function performs the following steps:
 * 1. Fetches the HTML content of the participant page.
 * 2. Parses the HTML using the DOMParser API.
 * 3. Select the dynamic core table containing participant data.
 * 4. Iterates over each row of the table and extracts:
 *    - Full participant name (excluding avatar initials),
 *    - Assigned role (e.g., Student, Teacher),
 *    - Associated group(s),
 *    - Last access duration (normalized to a standard time format),
 *    - Current status (e.g., Active, Not current).
 * 5. Returns a clean, structured list of `Participant` objects.
 *
 * @param participantsUrl - The full URL of the Moodle course participants page.
 * @returns A Promise resolving to an array of `Participant` objects.
 *          If the page cannot be parsed or an error occurs, it returns an empty array.
 *
 * @example
 * const url = "http://localhost:8080/user/index.php?id=2";
 * const participants = await scrapeParticipants(url);
 * console.log(participants);
 */
export async function scrapeParticipants(participantsUrl: string): Promise<Participant[]> {
    try {
        const doc = await fetchAndParse(participantsUrl);

        const participantsTable = doc.querySelector('[data-region="core_table/dynamic"]');
        const rows = Array.from(participantsTable?.querySelectorAll('tbody tr') ?? []);
        const participants: Participant[] = [];

        for (const row of rows) {
            const nameCell = row.querySelector('th.cell.c1');

            let participantName = '';
            const anchor = nameCell?.querySelector('a');
            if (anchor) {
                for (const node of anchor.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        participantName = node.textContent?.trim() ?? '';
                        break;
                    }
                }
            }

            const cells = row.querySelectorAll('td');

            if (cells.length >= 6) {
                const role = cells[2]?.innerText.trim() ?? '';

                const group = cells[3]?.innerText.trim() ?? '';

                const rawLastAccess = cells[4]?.innerText.trim() ?? '';
                const lastAccessToCourse = rawLastAccess === 'Never' ? 'Never' : normalizeDuration(rawLastAccess);

                const rawStatus = cells[5]?.innerText.trim() ?? '';
                const cleanedStatus = rawStatus.replace(/\s+/g, ' ').trim();
                const status = cleanedStatus.split(' ').pop() || '';

                const participant: Participant = {
                    participantName,
                    role,
                    group,
                    lastAccessToCourse,
                    status
                };

                participants.push(participant);
            }
        }
        return participants;

    } catch (error) {
        console.error("Error scraping participants:", error);
        return [];
    }
}

/**
 * Scrapes detailed performance data for a single Moodle quiz activity.
 *
 * This asynchronous function performs a sub-scraping operation to extract individual participant
 * statistics for a specific quiz identified by its internal Moodle `id`. It is intended to be used
 * as part of a broader scraping process, where activity metadata (e.g., name, views, last access)
 * is already available from a higher-level table such as the course activity report.
 *
 * The function accesses the Moodle quiz results page, parses the table of quiz attempts,
 * and extracts detailed information for each participant, including duration, raw grade,
 * and a normalized grade on a 0-10 scale.
 *
 * In addition, the function attempts to determine the maximum possible grade for the quiz,
 * which is used for the normalization process.
 *
 * Only meaningful participant rows are parsed. Rows without a valid name or marked as summary rows
 * (e.g., "Overall average") are excluded. Empty rows are also skipped.
 *
 * This function is designed to return a single quiz object wrapped in an array for compatibility
 * with the general `scrapeCourse` integration, which expects an array of quizzes.
 *
 * @param id - The unique identifier of the quiz activity (from the URL: `id=XYZ`).
 * @param activityName - The name/title of the quiz activity as shown in Moodle.
 * @param numViews - Number of times the quiz has been viewed.
 * @param lastAccess - The last access timestamp of the quiz activity, or `'Never'`.
 * @param totalParticipants - The total number of participants in the course, used for pagination or URL generation.
 *
 * @returns A `Promise` that resolves to an array containing one `Quiz` object with full details,
 *          or an empty array in case of an error.
 *
 * @example
 * const results = await scrapeQuizzes(42, 'Final Exam', '120', '25 June 2025', 175);
 * console.log(results[0].participantStats.length); // → Number of participant rows scraped
 */
export async function scrapeQuizzes(
    id: number,
    activityName: string,
    numViews: string,
    lastAccess: string,
    totalParticipants: number
): Promise<Quiz[]> {
    try {
        const quizzes: Quiz[] = [];

        const url = getScrapeUrlQuiz(id, totalParticipants);
        const doc = await fetchAndParse(url.quizResults);

        const gradeHeaderAnchor = doc.querySelector('a[aria-label^="Sort by Grade/"]');
        const gradeHeaderText = gradeHeaderAnchor?.textContent?.trim() ?? '';
        const maxGradeMatch = gradeHeaderText.match(/Grade\/([\d.]+)/);
        const maxGrade = parseFloat(maxGradeMatch?.[1] ?? '1'); // Fallback a 1 si no se encuentra

        const tableResultsQuiz = doc.querySelector('table#attempts');
        const rowsResultsQuiz = Array.from(tableResultsQuiz?.querySelectorAll('tbody tr') ?? []);
        const participantStats: QuizParticipantData[] = [];

        for (const rowQuiz of rowsResultsQuiz) {

            const rowClass = rowQuiz.className.trim().toLowerCase();
            if (rowClass.includes('emptyrow') || rowClass.includes('empty row')) {
                continue;
            }

            const nameCell = rowQuiz.querySelector('td.cell.c2');
            const nameText = nameCell?.textContent?.trim() ?? '';

            if (!nameText || nameText.toLowerCase().includes('overall average')) {
                continue;
            }

            const nameAnchor = nameCell?.querySelector('a');
            const participantName = nameAnchor?.textContent?.trim() ?? '';

            const durationCell = rowQuiz.querySelector('td.cell.c7');
            const rawDuration = durationCell?.textContent?.trim() ?? '';
            const duration = normalizeDuration(rawDuration);

            const gradeCell = rowQuiz.querySelector('td.cell.c8');
            const gradeAnchor = gradeCell?.querySelector('a');
            const gradeText = gradeAnchor?.textContent?.trim() ?? '';
            const grade = parseFloat(gradeText);  // Convertimos a número

            const normalizedGrade = normalizeGradeTo10(grade, maxGrade);

            const participantData: QuizParticipantData = {
                participantName,
                duration,
                grade,
                normalizedGrade
            };

            participantStats.push(participantData);
        }

        const quiz: Quiz = {
            activityName,
            numViews,
            lastAccess,
            id,
            maxGrade,
            participantStats
        };

        quizzes.push(quiz);

        return quizzes;

    } catch (error) {
        console.error("Error scraping Quizzes:", error);
        return [];
    }
}

/**
 * Scrapes participation data for a single Moodle forum activity, including per-participant statistics.
 *
 * This asynchronous function navigates through multiple pages related to a specific forum in Moodle
 * to extract detailed metadata, including the number of subscriptions and participant interaction
 * metrics such as posts, replies, views, and word count.
 *
 * The scraping process includes three main stages:
 * 1. **Main Forum Page**: Retrieves the forum's `forumId` via a link containing the `forumid` parameter.
 * 2. **Subscriptions Page**: Extracts the number of user subscriptions from the header text.
 * 3. **Reports Page**: Gathers a summary of participant activity, including posts and timestamps.
 *
 * Only participants with at least one type of activity (posts, replies, views, word count) are included.
 * Participant names are carefully extracted from `<a>` elements that contain child nodes, avoiding icons or spans.
 *
 * The function returns a single `Forum` object wrapped in an array for consistency with batch processing.
 *
 * @param id - The unique activity ID of the forum (extracted from `/mod/forum/view.php?id=XYZ`).
 * @param activityName - The name of the forum activity as displayed in Moodle.
 * @param numViews - Number of views recorded for the forum activity.
 * @param lastAccess - Last access time of the activity, or `'Never'` if not accessed.
 * @param totalParticipants - The total number of course participants (used for report pagination).
 * @param courseId - The course identifier, used in the construction of forum report URLs.
 *
 * @returns A `Promise` that resolves to an array containing one `Forum` object with its statistics,
 *          or an empty array in case of an error or unexpected page structure.
 *
 * @example
 * const forumStats = await scrapeForums(123, "General Discussion", "88", "June 25", 175, "2");
 * console.log(forumStats[0].subscriptions); // → Number of subscribed users
 */
export async function scrapeForums(
    id: number,
    activityName: string,
    numViews: string,
    lastAccess: string,
    totalParticipants: number,
    courseId: string
): Promise<Forum[]> {
    try {
        const forums: Forum[] = [];

        const urlForumMain = getScrapeUrlForumMain(id);
        let doc = await fetchAndParse(urlForumMain.forumMain);

        const reportLink = doc.querySelector('a[href*="forumid="]');
        const reportHref = reportLink?.getAttribute('href') ?? '';
        const forumIdMatch = reportHref.match(/forumid=(\d+)/);
        const forumId = parseInt(forumIdMatch?.[1] ?? '0');

        const urlForumSubscriptions = getScrapeUrlForumSubscriptions(forumId);

        doc = await fetchAndParse(urlForumSubscriptions.forumSubscriptions);

        const h2 = doc.querySelector('h2');
        const h2Text = h2?.textContent?.trim() ?? '';
        const subsMatch = h2Text.match(/\((\d+)\)/);
        const subscriptions = parseInt(subsMatch?.[1] ?? '0');

        const urlForumReports = getScrapeUrlForumReports(courseId, forumId, totalParticipants);
        doc = await fetchAndParse(urlForumReports.forumReports);

        const tableReportForum = doc.querySelector('table#forumreport_summary_table');
        const rowsReportForum = Array.from(tableReportForum?.querySelectorAll('tbody tr') ?? []);
        const participantsStats: ForumParticipantData[] = [];

        for (const rowForum of rowsReportForum) {

            const nameCell = rowForum.querySelector('td.cell.c1');

            let participantName = '';
            const anchor = nameCell?.querySelector('a');
            if (anchor) {
                for (const node of anchor.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        participantName = node.textContent?.trim() ?? '';
                        break;
                    }
                }
            }

            const discussionsPosted = parseInt(rowForum.querySelector('td.cell.c2')?.textContent?.trim() ?? '0');
            const repliesPosted = parseInt(rowForum.querySelector('td.cell.c3')?.textContent?.trim() ?? '0');
            const views = parseInt(rowForum.querySelector('td.cell.c5')?.textContent?.trim() ?? '0');
            const wordCount = parseInt(rowForum.querySelector('td.cell.c6')?.textContent?.trim() ?? '0');

            const earliestPost = rowForum.querySelector('td.cell.c8')?.textContent?.trim() ?? '';
            const mostRecentPost = rowForum.querySelector('td.cell.c9')?.textContent?.trim() ?? '';

            if (discussionsPosted === 0 && repliesPosted === 0 && views === 0 && wordCount === 0) {
                continue;
            }

            const participantData: ForumParticipantData = {
                participantName,
                discussionsPosted,
                repliesPosted,
                views,
                wordCount,
                earliestPost,
                mostRecentPost
            };

            participantsStats.push(participantData);
        }

        const forum: Forum = {
            activityName,
            numViews,
            lastAccess,
            id,
            forumId,
            subscriptions,
            participantsStats
        };

        forums.push(forum);


        return forums;

    } catch (error) {
        console.error("Error scraping Forums:", error);
        return [];
    }
}


/**
 * Scrapes all relevant data from a Moodle course by aggregating information from
 * multiple sources, including the activity report and the participants list.
 *
 * This function coordinates the scraping of all course components such as:
 * - Participants and access statistics.
 * - Activity metadata (views, access, and names).
 * - Detailed data for quizzes and forums via nested subscraping.
 *
 * It performs a **single pass** over the activity report table and dispatches
 * activity-specific scraping logic based on the type of each row (`mod/url/`, `mod/quiz/`, etc.).
 * Quizzes and forums are processed through dedicated helper functions (`scrapeQuizzes`, `scrapeForums`)
 * that retrieve additional per-participant metrics.
 *
 * ### Example Flow:
 * 1. **Participants Page**: Collects participant metadata and last access.
 * 2. **Activity Report Page**: Extracts activity type and basic stats for each row.
 * 3. **Quiz/Forum Detail Pages**: If applicable, gathers deep interaction metrics.
 *
 * @param courseId - Unique identifier of the course (as appears in Moodle URLs).
 * @param activityReportUrl - URL of the course’s activity report page.
 * @param participantsUrl - URL of the course’s participants page.
 * @param totalParticipants - Total number of participants enrolled in the course, used for pagination.
 *
 * @returns A `Promise` that resolves to a fully populated `Course` object containing:
 * - Lists of activities grouped by type (resources, quizzes, forums, etc.).
 * - Aggregated participant information.
 * - Total and active participant counts.
 *
 * @example
 * const courseData = await scrapeCourse("3", "http://localhost:8080/report/outline/index.php?id=3", "http://localhost:8080/user/index.php?id=3", 175);
 * console.log(courseData.quizzes.length); // → Number of quizzes in the course
 */
export async function scrapeCourse(
    courseId: string,
    activityReportUrl: string,
    participantsUrl: string,
    totalParticipants: number
): Promise<Course> {

    const participants = await scrapeParticipants(participantsUrl);
    const numParticipantsTotal = participants.length;
    const numParticipantsActive = participants.filter(p => p.lastAccessToCourse !== 'Never').length;

    const doc = await fetchAndParse(activityReportUrl);
    const table = doc.querySelector('table#outlinereport');
    const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []);

    const urlResources: URLResource[] = [];
    const choices: Choice[] = [];
    const workshops: Workshop[] = [];
    const resources: Resource[] = [];
    let quizzes: Quiz[] = [];
    let forums: Forum[] = [];

    for (const row of rows) {

        const activityCell = row.querySelector('td.activityname');
        const viewsCell = row.querySelector('td.numviews');
        const lastAccessCell = row.querySelector('td.lastaccess');
        const anchor = activityCell?.querySelector('a');
        const href = anchor?.getAttribute('href') ?? '';

        const activityName = anchor?.textContent?.trim() ?? '';
        const numViews = viewsCell?.textContent?.trim() ?? '';
        const lastAccess = lastAccessCell?.textContent?.trim() || 'Never';

        const idMatch = href.match(/id=(\d+)/);
        const id = parseInt(idMatch?.[1] ?? '0'); // Fallback a 0 si no hay match

        if (href.includes('/mod/url/')) {
            urlResources.push({activityName, numViews, lastAccess});
        } else if (href.includes('/mod/choice/')) {
            choices.push({activityName, numViews, lastAccess});
        } else if (href.includes('/mod/workshop/')) {
            workshops.push({activityName, numViews, lastAccess});
        } else if (href.includes('/mod/resource/')) {
            resources.push({activityName, numViews, lastAccess});
        } else if (href.includes('/mod/quiz/')) {
            const quizResults = await scrapeQuizzes(id, activityName, numViews, lastAccess, totalParticipants);
            quizzes.push(...quizResults);
        } else if (href.includes('/mod/forum/')) {
            const forumResults = await scrapeForums(id, activityName, numViews, lastAccess, totalParticipants, courseId);
            forums.push(...forumResults);
        }
    }
    // Step 4: Build and return the Course object
    return {
        id: parseInt(courseId),
        numParticipantsTotal,
        numParticipantsActive,
        participants,
        urlResources,
        resources,
        choices,
        workshops,
        quizzes,
        forums
    };
}
