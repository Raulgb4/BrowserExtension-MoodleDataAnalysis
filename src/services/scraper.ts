import {Participant} from '../models/Participant';
import {Choice, URLResource, Workshop, Resource} from "../models/ActivityBase";
import {Quiz, QuizStudentData} from "../models/Quiz";
import {Forum} from "../models/Forum";
import {getScrapeUrlQuiz} from "../utils/urlBuilder";

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
 * Scrapes the total number of students enrolled in a Moodle course from the participants page.
 *
 * This asynchronous function performs an HTTP `fetch` request to the provided `participantsUrl`,
 * which should point to the participants listing page of a Moodle course (e.g., `/user/index.php?id=COURSE_ID`).
 *
 * It retrieves the HTML content of the page and uses the `DOMParser` to parse it into a `Document` object.
 * The function then searches for the HTML table element responsible for displaying the dynamic list of participants.
 * This table contains a special attribute called `data-table-total-rows`, which represents the total number of enrolled users.
 *
 * If this attribute is found and correctly parsed into a valid integer, the function returns it as the total number of students.
 * If the attribute is missing or invalid, or if any error occurs during fetching or parsing, the function returns `null`.
 *
 * This scraping logic is used to dynamically determine pagination sizes and resource limits for subsequent
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
 * const total = await scrapeTotalStudents("http://localhost:8080/user/index.php?id=2");
 * if (total !== null) {
 *   console.log("Total students:", total);
 * } else {
 *   console.warn("Unable to extract student count.");
 * }
 */
export async function scrapeTotalStudents(participantsUrl: string): Promise<number | null> {
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
        console.error("Error scraping total students:", error);
        return null;
    }
}

/**
 * Scrapes the participants table from a given Moodle participants page URL,
 * extracting relevant information for each user enrolled in the course.
 *
 * This function performs the following steps:
 * 1. Fetches the HTML content of the participants page.
 * 2. Parses the HTML using the DOMParser API.
 * 3. Selects the dynamic core table containing participant data.
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


/** TO DO:
 *
 * El objetivo actual es desarrollar en el archivo scraper.ts un conjunto de funciones de scrapeo, cada una especializada
 * en extraer información de un tipo concreto de actividad Moodle. En concreto, los tipos de elementos que quiero manejar
 * son: URLResource, Choice, Workshop, Resource, Quiz y Forum.
 *
 * La razón por la que opto por crear una función separada para cada tipo es que, aunque todos
 * los elementos aparecen mezclados en una misma tabla dentro de la página http://localhost:8080/report/outline/index.php?id=2,
 * cada tipo de actividad requiere un tratamiento diferente. Algunos elementos como los recursos (URLResource, Resource) solo
 * necesitan los datos visibles directamente en la tabla (nombre de la actividad, número de visitas y fecha del último acceso).
 * Sin embargo, otros elementos como los Quiz o los Forum necesitan realizar un scrapeo adicional (subscrapeo) porque la tabla
 * principal solo ofrece una vista superficial. Para estos casos, es necesario seguir el enlace que apunta a la actividad
 * concreta, extraer el id del enlace, y desde ahí acceder a otras páginas o reportes específicos para completar la información.
 *
 * Por tanto, la estrategia consiste en:
 *     Extraer todos los elementos de la tabla presente en la página del informe de actividad (outline report).
 *     Identificar el tipo de cada elemento a través del href o clases del icono asociado.
 *     Enviar cada fila al scraper correspondiente según su tipo (scrapeURLResources, scrapeQuizzes, etc.), que decidirá
 *     si es suficiente con los datos de la tabla o si necesita hacer un subscrapeo adicional.
 */

export async function scrapeURLResources(activityReportUrl: string): Promise<URLResource[]> {
    try{
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

export async function scrapeChoices(activityReportUrl: string): Promise<Choice[]> {
    try{
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

export async function scrapeWorkshops(activityReportUrl: string): Promise<Workshop[]> {
    try{
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

export async function scrapeResources(activityReportUrl: string): Promise<Resource[]> {
    try{
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

export async function scrapeQuizzes(activityReportUrl: string, totalStudents: number): Promise<Quiz[]> {
    try{
        const response = await fetch(activityReportUrl);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

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


            // Subscrapping to get quiz results

            const url = getScrapeUrlQuiz(id, totalStudents);

            const response2 = await fetch(url.quizResults);
            const html2 = await response2.text();

            const parser2 = new DOMParser();
            const doc2 = parser2.parseFromString(html2, 'text/html');

            const tableResultsQuiz = doc2.querySelector('table#attempts');
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

                // Creamos el objeto con los datos
                const studentData: QuizStudentData = {
                    studentName,
                    duration,
                    grade
                };

                studentStats.push(studentData);
            }

            const quiz: Quiz = {
                activityName,
                numViews,
                lastAccess,
                id,
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

export async function scrapeForums(activityReportUrl: string): Promise<Forum[]> {
    try{
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

            const forum: Forum = {
                activityName,
                numViews,
                lastAccess,
                id,
                forumId: 0, // TO DO: Extract from the forum report (SUBSCRAPING NECESSARY)
                subscriptions: 0, // TO DO: Extract from the forum report (SUBSCRAPING NECESSARY)
                studentsStats: [] // TO DO: Extract from the forum report (SUBSCRAPING NECESSARY)
            };

            forums.push(forum);
        }

        return forums;

    } catch (error) {
        console.error("Error scraping Forums:", error);
        return [];
    }
}




