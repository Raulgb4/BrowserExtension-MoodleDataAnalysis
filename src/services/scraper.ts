import { Participant } from '../models/Participant';

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
                // Iteramos sobre los nodos hijos del <a> y cogemos el primer nodo de texto (el nombre real)
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
                const lastAccessToCourse = normalizeDuration(rawLastAccess);

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
