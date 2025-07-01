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
import {Quiz, QuizStudentData} from "../models/Quiz";
import {Forum, ForumStudentData} from "../models/Forum";
import {
    getScrapeUrlQuiz,
    getScrapeUrlForumMain,
    getScrapeUrlForumReports,
    getScrapeUrlForumSubscriptions
} from "../utils/urlBuilder";

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
 * @param grade The original grade obtained by the student.
 * @param maxGrade The maximum possible grade for the quiz.
 * @returns The grade normalized to a scale of 0 to 10.
 */
export function normalizeGradeTo10(grade: number, maxGrade: number): number {
    if (maxGrade === 0) return 0;
    return parseFloat(((grade / maxGrade) * 10).toFixed(2));
}

/**
 * (⚠️TO DO IMPLEMENTATION FOR EACH SCRAPING) Fetches the content of a given URL and parses it into a DOM Document.
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
 *   console.warn("Unable to extract student count.");
 * }
 */
export async function scrapeNumParticipants(participantsUrl: string): Promise<number | null> {
    try {
        const response = await fetch(participantsUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

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
        const response = await fetch(participantsUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

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
 * Scrapes all external URL-based resources from the Moodle activity report page.
 *
 * This function is designed to extract information about activities of type `url`
 * (external links added to the course), which are listed in a single unified table
 * on the activity outline report page (`report/outline/index.php`).
 *
 * The scraping process performs the following steps:
 * 1. Send an HTTP request to the activity report page (`activityReportUrl`).
 * 2. Parses the received HTML into a DOM structure using the DOMParser API.
 * 3. Locate the main activity table with the ID `outlinereport`.
 * 4. Iterates over each row in the table to identify rows containing a `url` activity:
 *    - These are detected by checking that the activity link's href contains `/mod/url/`.
 * 5. For each matching row, it extracts:
 *    - The activity name (as displayed in the first column),
 *    - The number of views (from the second column),
 *    - The last access date/time (from the third column).
 * 6. Creates a `URLResource` object for each matched activity and adds it to a list.
 *
 * If an error occurs at any stage (e.g., network issue, parsing error), the function logs
 * the error to the console and returns an empty array to avoid crashing the application.
 *
 * @param activityReportUrl - The full URL of the Moodle activity report page for a course.
 * @returns A Promise resolving to an array of `URLResource` objects.
 *          Each object contains `activityName`, `numViews`, and `lastAccess`.
 *
 * @example
 * const url = "http://localhost:8080/report/outline/index.php?id=2";
 * const resources = await scrapeURLResources(url);
 * console.log(resources);
 */
export async function scrapeURLResources(activityReportUrl: string): Promise<URLResource[]> {
    try {
        const response = await fetch(activityReportUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const table = doc.querySelector('table#outlinereport');
        const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []);
        const urlResources: URLResource[] = [];

        for (const row of rows) {

            const activityCell = row.querySelector('td.activityname');
            const viewsCell = row.querySelector('td.numviews');
            const lastAccessCell = row.querySelector('td.lastaccess');

            const anchor = activityCell?.querySelector('a');
            const href = anchor?.getAttribute('href') ?? '';

            if (!href.includes('/mod/url/')) continue;

            const activityName = anchor?.textContent?.trim() ?? '';
            const numViews = viewsCell?.textContent?.trim() ?? '';
            const lastAccess = lastAccessCell?.textContent?.trim() || 'Never';

            const urlResource: URLResource = {
                activityName,
                numViews,
                lastAccess
            };

            urlResources.push(urlResource);
        }

        return urlResources;

    } catch (error) {
        console.error("Error scraping URLResources:", error);
        return [];
    }
}

/**
 * Scrapes all `Choice` activities from the Moodle activity report page.
 *
 * This function is responsible for extracting data about activities of type `choice`,
 * which represent multiple-choice polls where students can select one or more options.
 * These activities are listed along with other activity types in the same HTML table
 * on the course's outline report page (`report/outline/index.php`).
 *
 * The scraping process follows these steps:
 * 1. Send an HTTP request to the given `activityReportUrl`.
 * 2. Parses the retrieved HTML using the DOMParser API to construct a DOM tree.
 * 3. Locate the activity table with the ID `outlinereport`.
 * 4. Iterates over all `<tr>` rows inside the table body (`<tbody>`).
 * 5. Filters rows to include only those where the activity link's `href`
 *    contains the substring `/mod/choice/`, indicating a `choice` activity.
 * 6. For each matching row, extract the following data:
 *    - `activityName`: The title of the poll (from the activity link text),
 *    - `numViews`: Number of times the activity has been accessed,
 *    - `lastAccess`: Timestamp or label indicating the user's last access (e.g., "Never").
 * 7. Each set of extracted data is stored in a `Choice` object, which is added to the result list.
 *
 * If any error occurs during the process (network failure, parsing issues, etc.),
 * it is logged to the console, and the function returns an empty array to ensure the extension remains stable.
 *
 * @param activityReportUrl - The full URL of the Moodle activity report page for a course.
 * @returns A Promise resolving to an array of `Choice` objects.
 *          Each object contains `activityName`, `numViews`, and `lastAccess`.
 *
 * @example
 * const url = "http://localhost:8080/report/outline/index.php?id=2";
 * const choices = await scrapeChoices(url);
 * console.log(choices);
 */
export async function scrapeChoices(activityReportUrl: string): Promise<Choice[]> {
    try {
        const response = await fetch(activityReportUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const table = doc.querySelector('table#outlinereport');
        const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []);
        const choices: Choice[] = [];

        for (const row of rows) {

            const activityCell = row.querySelector('td.activityname');
            const viewsCell = row.querySelector('td.numviews');
            const lastAccessCell = row.querySelector('td.lastaccess');

            const anchor = activityCell?.querySelector('a');
            const href = anchor?.getAttribute('href') ?? '';

            if (!href.includes('/mod/choice/')) continue;

            const activityName = anchor?.textContent?.trim() ?? '';
            const numViews = viewsCell?.textContent?.trim() ?? '';
            const lastAccess = lastAccessCell?.textContent?.trim() || 'Never';

            const choice: Choice = {
                activityName,
                numViews,
                lastAccess
            };

            choices.push(choice);
        }

        return choices;

    } catch (error) {
        console.error("Error scraping Choices:", error);
        return [];
    }
}

/**
 * Scrapes all `Workshop` activities from the Moodle activity report page.
 *
 * This function is designed to extract metadata about peer-assessment activities
 * (of type `workshop`) from the course’s outline report page (`report/outline/index.php`).
 * These activities appear in the same table as other activity types and must be filtered
 * based on their unique URL pattern.
 *
 * The scraping process includes the following steps:
 * 1. Send an HTTP GET request to the provided `activityReportUrl`.
 * 2. Parses the returned HTML document using `DOMParser` to access DOM elements.
 * 3. Locates the `<table>` with ID `outlinereport`, which lists course activities.
 * 4. Iterates over all `<tr>` elements in the table body.
 * 5. Filters rows to include only those that contain `/mod/workshop/` in the `<a href>` URL.
 * 6. For each matching workshop activity, extracts:
 *    - `activityName`: The name of the workshop activity,
 *    - `numViews`: How many times the activity has been accessed,
 *    - `lastAccess`: The last time the user accessed the activity (or "Never" if empty).
 * 7. Each set of extracted values is stored in a `Workshop` object and appended to the result list.
 *
 * If any network error or parsing issue occurs, the error is logged to the console,
 * and the function returns an empty array to prevent the extension from breaking.
 *
 * @param activityReportUrl - The full URL of the Moodle activity report page.
 * @returns A Promise resolving to an array of `Workshop` objects,
 *          each containing `activityName`, `numViews`, and `lastAccess`.
 *
 * @example
 * const url = "http://localhost:8080/report/outline/index.php?id=2";
 * const workshops = await scrapeWorkshops(url);
 * console.log(workshops);
 */
export async function scrapeWorkshops(activityReportUrl: string): Promise<Workshop[]> {
    try {
        const response = await fetch(activityReportUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const table = doc.querySelector('table#outlinereport');
        const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []);
        const workshops: Workshop[] = [];

        for (const row of rows) {

            const activityCell = row.querySelector('td.activityname');
            const viewsCell = row.querySelector('td.numviews');
            const lastAccessCell = row.querySelector('td.lastaccess');

            const anchor = activityCell?.querySelector('a');
            const href = anchor?.getAttribute('href') ?? '';

            if (!href.includes('/mod/workshop/')) continue;

            const activityName = anchor?.textContent?.trim() ?? '';
            const numViews = viewsCell?.textContent?.trim() ?? '';
            const lastAccess = lastAccessCell?.textContent?.trim() || 'Never';

            const workshop: Workshop = {
                activityName,
                numViews,
                lastAccess
            };

            workshops.push(workshop);
        }

        return workshops;

    } catch (error) {
        console.error("Error scraping Workshops:", error);
        return [];
    }
}

/**
 * Scrapes all `Resource` activities from the Moodle activity report page.
 *
 * This function extracts metadata about static course resources (e.g., files, PDFs, documents)
 * by parsing the outline report and filtering rows that represent `/mod/resource/` entries.
 *
 * The process includes:
 * 1. Fetching the HTML content from the activity report URL.
 * 2. Locating the table with ID `outlinereport`.
 * 3. Iterating over each row in the table to identify resources.
 * 4. For each resource row, extracting:
 *    - `activityName`: Title of the resource,
 *    - `numViews`: Number of times it was accessed,
 *    - `lastAccess`: Last time the resource was accessed (or `"Never"`).
 *
 * The result is a structured array of `Resource` objects.
 * If an error occurs during the process, it is logged and an empty array is returned.
 *
 * @param activityReportUrl - Full URL to the Moodle course's activity report.
 * @returns A Promise resolving to a list of `Resource` objects.
 */
export async function scrapeResources(activityReportUrl: string): Promise<Resource[]> {
    try {
        const response = await fetch(activityReportUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const table = doc.querySelector('table#outlinereport');
        const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []);
        const resources: Resource[] = [];

        for (const row of rows) {

            const activityCell = row.querySelector('td.activityname');
            const viewsCell = row.querySelector('td.numviews');
            const lastAccessCell = row.querySelector('td.lastaccess');

            const anchor = activityCell?.querySelector('a');
            const href = anchor?.getAttribute('href') ?? '';

            if (!href.includes('/mod/resource/')) continue;

            const activityName = anchor?.textContent?.trim() ?? '';
            const numViews = viewsCell?.textContent?.trim() ?? '';
            const lastAccess = lastAccessCell?.textContent?.trim() || 'Never';

            const resource: Resource = {
                activityName,
                numViews,
                lastAccess
            };

            resources.push(resource);
        }

        return resources;

    } catch (error) {
        console.error("Error scraping Resources:", error);
        return [];
    }
}

/**
 * Scrapes all `Quiz` activities from the Moodle activity report page,
 * and performs a secondary scrape to extract per-student quiz results.
 *
 * This function performs a two-level scraping process:
 *
 * 1. **Main Activity Report Scrape**:
 *    - Fetches the activity report page.
 *    - Parses the `#outlinereport` table.
 *    - Filters rows whose links match the `/mod/quiz/` path.
 *    - Extracts basic metadata:
 *      - `activityName`: Name of the quiz activity.
 *      - `numViews`: Number of views.
 *      - `lastAccess`: Last access date/time.
 *      - `id`: Quiz identifier extracted from the URL.
 *
 * 2. **Subscraping for Quiz Results**:
 *    - Builds a URL using `getScrapeUrlQuiz()` to access detailed quiz results.
 *    - Fetches the quiz attempts table (`#attempts`).
 *    - Iterates through each row and extracts:
 *      - `studentName`: Name of the student.
 *      - `duration`: Duration of the quiz attempt (normalized).
 *      - `grade`: Grade obtained by the student.
 *    - Skip rows with class `emptyrow` or `empty row` to avoid malformed entries.
 *
 * Each quiz object returned includes both metadata and an array of `QuizStudentData`.
 * If an error occurs at any point, it is logged and the function returns an empty array.
 *
 * @param activityReportUrl - Full URL to the Moodle course activity report page.
 * @param totalParticipants - Number of participants used to bypass pagination in the subscrape.
 * @returns A Promise resolving to an array of `Quiz` objects including student results.
 */
export async function scrapeQuizzes(activityReportUrl: string, totalParticipants: number): Promise<Quiz[]> {
    try {
        let response = await fetch(activityReportUrl);
        let html = await response.text();
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, 'text/html');

        const table = doc.querySelector('table#outlinereport');
        const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []);
        const quizzes: Quiz[] = [];

        for (const row of rows) {

            const activityCell = row.querySelector('td.activityname');
            const viewsCell = row.querySelector('td.numviews');
            const lastAccessCell = row.querySelector('td.lastaccess');


            const anchor = activityCell?.querySelector('a');
            const href = anchor?.getAttribute('href') ?? '';

            if (!href.includes('/mod/quiz/')) continue;

            const activityName = anchor?.textContent?.trim() ?? '';
            const numViews = viewsCell?.textContent?.trim() ?? '';
            const lastAccess = lastAccessCell?.textContent?.trim() || 'Never';

            const idMatch = href.match(/id=(\d+)/);
            const id = parseInt(idMatch?.[1] ?? '0'); // Fallback a 0 si no hay match


            // Subscraping to get quiz results

            const url = getScrapeUrlQuiz(id, totalParticipants);

            response = await fetch(url.quizResults);
            html = await response.text();
            parser = new DOMParser(); // O simplemente reutilizar el anterior
            doc = parser.parseFromString(html, 'text/html');

            // Extraer la nota máxima del quiz (por ejemplo, 1.00, 5.00, 10.00)
            const gradeHeaderAnchor = doc.querySelector('a[aria-label^="Sort by Grade/"]');
            const gradeHeaderText = gradeHeaderAnchor?.textContent?.trim() ?? '';
            const maxGradeMatch = gradeHeaderText.match(/Grade\/([\d.]+)/);
            const maxGrade = parseFloat(maxGradeMatch?.[1] ?? '1'); // Fallback a 1 si no se encuentra

            const tableResultsQuiz = doc.querySelector('table#attempts');
            const rowsResultsQuiz = Array.from(tableResultsQuiz?.querySelectorAll('tbody tr') ?? []);
            const studentStats: QuizStudentData[] = [];

            for (const rowQuiz of rowsResultsQuiz) {

                // Saltar si la fila tiene clase "emptyrow" o "empty row"
                const rowClass = rowQuiz.className.trim().toLowerCase();
                if (rowClass.includes('emptyrow') || rowClass.includes('empty row')) {
                    continue;
                }

                // Nombre del estudiante (columna c2)
                const nameCell = rowQuiz.querySelector('td.cell.c2');
                const nameText = nameCell?.textContent?.trim() ?? '';

                // Excluir filas sin nombre de estudiante o que contienen "Overall average"
                if (!nameText || nameText.toLowerCase().includes('overall average')) {
                    continue;
                }

                const nameAnchor = nameCell?.querySelector('a');
                const studentName = nameAnchor?.textContent?.trim() ?? '';


                // Duración del intento (columna c7)
                const durationCell = rowQuiz.querySelector('td.cell.c7');
                const rawDuration = durationCell?.textContent?.trim() ?? '';
                const duration = normalizeDuration(rawDuration);

                // Nota obtenida (columna c8)
                const gradeCell = rowQuiz.querySelector('td.cell.c8');
                const gradeAnchor = gradeCell?.querySelector('a');
                const gradeText = gradeAnchor?.textContent?.trim() ?? '';
                const grade = parseFloat(gradeText);  // Convertimos a número

                // Normalizar la nota a una escala de 0 a 10
                const normalizedGrade = normalizeGradeTo10(grade, maxGrade);

                // Creamos el objeto con los datos
                const studentData: QuizStudentData = {
                    studentName,
                    duration,
                    grade,
                    normalizedGrade
                };

                studentStats.push(studentData);
            }

            const quiz: Quiz = {
                activityName,
                numViews,
                lastAccess,
                id,
                maxGrade,
                studentStats
            };

            quizzes.push(quiz);
        }

        return quizzes;

    } catch (error) {
        console.error("Error scraping Quizzes:", error);
        return [];
    }
}

/**
 * (⚠️TO DO SUBSCRIPTIONS AND REPORTS SUBSCRAPING) Scrapes all `Forum` activities from the Moodle activity report page.
 *
 * This function is responsible for retrieving basic metadata of forum activities
 * listed in the outline report and preparing the structure for a future subscraping step.
 *
 * Current behavior:
 * 1. **Main Activity Report Scrape**:
 *    - Fetches and parses the `#outlinereport` table from the provided course report URL.
 *    - Filters rows containing a link to `/mod/forum/` activities.
 *    - Extracts:
 *      - `activityName`: Forum name.
 *      - `numViews`: Number of times the forum was viewed.
 *      - `lastAccess`: Last time the forum was accessed.
 *      - `id`: Extracted from the forum URL (used to build further scraping URLs).
 *
 * 2. **TO DO – Subscraping Phase (Pending Implementation)**:
 *    - Extract the real `forumId` by visiting the forum's main page.
 *    - Scrape participation statistics from `/mod/forum/report/summary/index.php`.
 *    - Scrape the number of subscribed users from `/mod/forum/subscribers.php`.
 *    - Populate `forumId`, `subscriptions`, and `studentsStats` fields accordingly.
 *
 * If any parsing or network error occurs, the function logs the error and returns an empty list.
 *
 * @param activityReportUrl - Full URL of the Moodle course activity report page.
 * @param totalParticipants
 * @param courseId
 * @returns A Promise resolving to an array of `Forum` objects (partially filled).
 */
export async function scrapeForums(activityReportUrl: string, totalParticipants: number, courseId: string): Promise<Forum[]> {
    try {
        const response = await fetch(activityReportUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const table = doc.querySelector('table#outlinereport');
        const rows = Array.from(table?.querySelectorAll('tbody tr') ?? []);
        const forums: Forum[] = [];

        for (const row of rows) {

            const activityCell = row.querySelector('td.activityname');
            const viewsCell = row.querySelector('td.numviews');
            const lastAccessCell = row.querySelector('td.lastaccess');

            const anchor = activityCell?.querySelector('a');
            const href = anchor?.getAttribute('href') ?? '';

            if (!href.includes('/mod/forum/')) continue;

            const activityName = anchor?.textContent?.trim() ?? '';
            const numViews = viewsCell?.textContent?.trim() ?? '';
            const lastAccess = lastAccessCell?.textContent?.trim() || 'Never';

            const idMatch = href.match(/id=(\d+)/);
            const id = parseInt(idMatch?.[1] ?? '0'); // Fallback a 0 si no hay match

            const urlForumMain = getScrapeUrlForumMain(id);

            const response2 = await fetch(urlForumMain.forumMain);
            const html2 = await response2.text();

            const parser2 = new DOMParser();
            const doc2 = parser2.parseFromString(html2, 'text/html');

            // Scrapeo el parámetro forumId

            // Buscar el enlace de report que contenga forumid
            const reportLink = doc2.querySelector('a[href*="forumid="]');
            const reportHref = reportLink?.getAttribute('href') ?? '';
            const forumIdMatch = reportHref.match(/forumid=(\d+)/);
            const forumId = parseInt(forumIdMatch?.[1] ?? '0');

            const urlForumSubscriptions = getScrapeUrlForumSubscriptions(forumId);
            const urlForumReports = getScrapeUrlForumReports(courseId, forumId, totalParticipants);

            const response4 = await fetch(urlForumSubscriptions.forumSubscriptions);
            const html4 = await response4.text();
            const parser4 = new DOMParser();
            const doc4 = parser4.parseFromString(html4, 'text/html');

            const h2 = doc4.querySelector('h2');
            const h2Text = h2?.textContent?.trim() ?? '';
            const subsMatch = h2Text.match(/\((\d+)\)/);
            const subscriptions = parseInt(subsMatch?.[1] ?? '0');

            const response3 = await fetch(urlForumReports.forumReports);
            const html3 = await response3.text();
            const parser3 = new DOMParser();
            const doc3 = parser3.parseFromString(html3, 'text/html');

            const tableReportForum = doc3.querySelector('table#forumreport_summary_table');
            const rowsReportForum = Array.from(tableReportForum?.querySelectorAll('tbody tr') ?? []);
            const studentsStats: ForumStudentData[] = [];

            for (const rowForum of rowsReportForum) {

                const nameCell = rowForum.querySelector('td.cell.c1');

                let studentName = '';
                const anchor = nameCell?.querySelector('a');
                if (anchor) {
                    for (const node of anchor.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            studentName = node.textContent?.trim() ?? '';
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

                // Skip students with no activity
                if (discussionsPosted === 0 && repliesPosted === 0 && views === 0 && wordCount === 0) {
                    continue;
                }

                const studentData: ForumStudentData = {
                    studentName,
                    discussionsPosted,
                    repliesPosted,
                    views,
                    wordCount,
                    earliestPost,
                    mostRecentPost
                };

                studentsStats.push(studentData);
            }

            const forum: Forum = {
                activityName,
                numViews,
                lastAccess,
                id,
                forumId,
                subscriptions,
                studentsStats
            };

            forums.push(forum);
        }

        return forums;

    } catch (error) {
        console.error("Error scraping Forums:", error);
        return [];
    }
}




