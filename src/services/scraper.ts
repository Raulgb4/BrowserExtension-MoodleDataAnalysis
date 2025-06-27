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
 * Scrapes detailed participant information from the Moodle participants table.
 *
 * This asynchronous function fetches the HTML content of the specified Moodle participants page
 * and extracts individual participant records by parsing the corresponding HTML table structure.
 *
 * It targets the dynamic table marked with the `data-region="core_table/dynamic"` attribute,
 * and iterates over each `<tr>` element within the `<tbody>`, which represents a row in the participants list.
 *
 * For each row, the following fields are extracted:
 *
 * - **Full name**: Retrieved from the `<a>` element within the `<th>` element with class `cell c1`.
 * - **Role**: Retrieved from the 3rd `<td>` cell (index 2).
 * - **Group**: Retrieved from the 4th `<td>` cell (index 3).
 * - **Last access to course**: Retrieved from the 5th `<td>` cell (index 4).
 * - **Status**: Retrieved from the 6th `<td>` cell (index 5).
 *
 * These fields are used to construct a list of `Participant` objects conforming to the `Participant` interface.
 *
 * If the structure of the page does not match expectations, or if an error occurs during the fetch or parsing,
 * the function gracefully returns an empty array.
 *
 * This method is useful for extracting rich student metadata, enabling further analysis of roles,
 * activity levels, and group composition within a Moodle course.
 *
 * @param participantsUrl - Full URL to the Moodle participants page (e.g., `/user/index.php?id=COURSE_ID`)
 *
 * @returns A `Promise` that resolves to:
 *   - An array of `Participant` objects, each containing parsed participant information.
 *   - An empty array `[]` if parsing fails or an error occurs.
 *
 * @example
 * const participants = await scrapeParticipants("http://localhost:8080/user/index.php?id=2");
 * console.log("Participants:", participants);
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
            const participantName = nameCell?.querySelector('a')?.textContent?.trim() ?? '';

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
