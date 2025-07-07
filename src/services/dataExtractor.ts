/**
 * @file dataExtractor.ts
 * @description Centralized module for scraping various Moodle course sections
 *
 * @author Raúl García Balongo
 * @date 2025
 */

// Models
import {Participant} from '../models/Participant';
import {Resource, URLResource, Workshop} from '../models/ActivityBase';
import {Quiz, QuizParticipantData} from '../models/Quiz';
import {Forum, ForumParticipantData} from '../models/Forum';
import {Choice} from '../models/Choice';
import {Course} from '../models/Course';

// Data processing utilities
import {
    normalizeTimeToMillis,
    normalizeGradeTo10,
    parseRoles,
    parseGroups,
    parseLastAccess,
    parseStatus,
    parseCellToInt,
    parseViewsAndUsers
} from './dataProcessor';

// URL builders
import {
    getScrapeUrlChoice,
    getScrapeUrlForumMain,
    getScrapeUrlForumReports,
    getScrapeUrlForumSubscriptions,
    getScrapeUrlQuiz
} from '../utils/urlBuilder';

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
 * Retrieves the total number of participants from the Moodle participants page.
 *
 * This function fetches the HTML content of the given participants URL,
 * locates the dynamic table element, and extracts the total number of rows
 * from the corresponding HTML attribute.
 *
 * @param participantsUrl - The full URL of the Moodle participants page to scrape.
 * @returns The total number of participants as a number, or null if not found or an error occurs.
 */
export async function scrapeNumParticipants(participantsUrl: string): Promise<number | null> {
    try {
        const doc = await fetchAndParse(participantsUrl);

        const totalRowsAttr = doc
            .querySelector('[data-region="core_table/dynamic"]')
            ?.getAttribute("data-table-total-rows");

        if (!totalRowsAttr) return null;

        const totalRows = parseInt(totalRowsAttr, 10);
        return isNaN(totalRows) ? null : totalRows;

    } catch (error) {
        console.error("Error scraping total participants:", error);
        return null;
    }
}

/**
 * Scrapes the list of participants from a Moodle course's participant page.
 *
 * This function parses the participant table, extracting each user's basic information,
 * such as name, ID, email, roles, groups, last access time, and status.
 * Rows without valid IDs or names are skipped.
 *
 * @param participantsUrl - The full URL of the Moodle participants page to scrape.
 * @returns A promise that resolves to an array of `Participant` objects, or an empty array if none are found or an error occurs.
 */
export async function scrapeParticipants(participantsUrl: string): Promise<Participant[]> {
    try {
        const doc = await fetchAndParse(participantsUrl);

        const participantsTable = doc.querySelector('[data-region="core_table/dynamic"]');
        const rows = Array.from(participantsTable?.querySelectorAll('tbody tr') ?? []);
        const participants: Participant[] = [];

        for (const row of rows) {
            const nameCell = row.querySelector('th.cell.c1');
            const anchor = nameCell?.querySelector('a');

            if (!anchor) continue;

            const nameNode = Array.from(anchor.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            const participantName = nameNode?.textContent?.trim();
            if (!participantName || participantName === '-') continue;

            const href = anchor.getAttribute('href') ?? '';
            const idMatch = href.match(/id=(\d+)/);
            if (!idMatch) {
                console.warn("User ID not found for participant:", participantName);
                continue;
            }

            const id = parseInt(idMatch[1]);

            const cells = row.querySelectorAll('td');
            if (cells.length < 6) continue;

            const email = cells[1]?.textContent?.trim() ?? '';
            const roles = parseRoles(cells[2]?.innerText);
            const groups = parseGroups(cells[3]?.innerText);
            const lastAccessToCourse = parseLastAccess(cells[4]?.innerText);
            const status = parseStatus(cells[5]?.innerText);

            const participant: Participant = {
                id,
                email,
                participantName,
                roles,
                groups,
                lastAccessToCourse,
                status
            };

            participants.push(participant);

        }
        return participants;

    } catch (error) {
        console.error("Error scraping participants:", error);
        return [];
    }
}

/**
 * Scrapes the response data from a specific Choice activity in Moodle.
 *
 * This function retrieves the options available in the Choice activity and the number
 * of responses submitted for each option, based on the result table in the activity's page.
 *
 * @param id - The unique identifier of the Choice activity.
 * @param activityName - The display name of the activity as shown in the course.
 * @param numViews - The total number of times the activity has been viewed.
 * @param numUsers - The number of unique users who viewed the activity.
 * @param lastAccess - The timestamp (in milliseconds) of the last recorded access to the activity.
 * @returns A promise that resolves to an array containing a single `Choice` object with response data,
 *          or an empty array if scraping fails.
 */
export async function scrapeChoices(
    id: number,
    activityName: string,
    numViews: number,
    numUsers: number,
    lastAccess: number | undefined,
): Promise<Choice[]> {
    try {
        const choices: Choice[] = [];

        const url = getScrapeUrlChoice(id);
        const doc = await fetchAndParse(url.choiceResults);

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

            const value = parseInt(cell.textContent?.trim() ?? '0');
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
        return choices;

    } catch (error) {
        console.error("Error scraping Choices:", error);
        return [];
    }
}

/**
 * Scrapes detailed quiz results for a specific Moodle quiz activity.
 *
 * This function retrieves each participant's performance data in the quiz, including
 * duration, raw grade, and normalized grade. It also extracts the maximum possible grade
 * for normalization and compiles all data into a `Quiz` object.
 *
 * @param id - The unique identifier of the quiz activity.
 * @param activityName - The display name of the quiz as shown in the course.
 * @param numViews - The total number of views for the quiz.
 * @param numUsers - The number of unique users who viewed the quiz.
 * @param lastAccess - The timestamp (in milliseconds) of the last recorded access to the quiz.
 * @param totalParticipants - The total number of participants in the course, used for URL construction.
 * @returns A promise that resolves to an array containing a single `Quiz` object with participant results,
 *          or an empty array if scraping fails.
 */
export async function scrapeQuizzes(
    id: number,
    activityName: string,
    numViews: number,
    numUsers: number,
    lastAccess: number | undefined,
    totalParticipants: number
): Promise<Quiz[]> {
    try {
        const quizzes: Quiz[] = [];

        const url = getScrapeUrlQuiz(id, totalParticipants);
        const doc = await fetchAndParse(url.quizResults);

        const gradeHeaderAnchor = doc.querySelector('a[aria-label^="Sort by Grade/"]');
        const gradeHeaderText = gradeHeaderAnchor?.textContent?.trim() ?? '';
        const maxGradeMatch = gradeHeaderText.match(/Grade\/([\d.]+)/);
        const maxGrade = parseFloat(maxGradeMatch?.[1] ?? '1');

        const tableResultsQuiz = doc.querySelector('table#attempts');
        const rowsResultsQuiz = Array.from(tableResultsQuiz?.querySelectorAll('tbody tr') ?? []);
        const participantStats: QuizParticipantData[] = [];

        for (const rowQuiz of rowsResultsQuiz) {

            const rowClass = rowQuiz.className.trim().toLowerCase();
            if (rowClass.includes('emptyrow') || rowClass.includes('empty row')) continue;

            const nameCell = rowQuiz.querySelector('td.cell.c2');
            const nameText = nameCell?.textContent?.trim().toLowerCase() ?? '';
            if (!nameText || nameText.includes('overall average')) continue;

            const nameAnchor = nameCell?.querySelector('a');
            const participantName = nameAnchor?.textContent?.trim() ?? '';

            const idMatch = nameAnchor?.getAttribute('href')?.match(/id=(\d+)/);
            if (!idMatch) {
                console.warn("User ID not found for participant:", participantName);
                continue;
            }
            const participantId = parseInt(idMatch[1]);

            const rawDuration = rowQuiz.querySelector('td.cell.c7')?.textContent?.trim() ?? '';
            const duration = normalizeTimeToMillis(rawDuration);

            const gradeText = rowQuiz.querySelector('td.cell.c8 a')?.textContent?.trim() ?? '';
            const grade = parseFloat(gradeText);
            const normalizedGrade = normalizeGradeTo10(grade, maxGrade);

            const participantData: QuizParticipantData = {
                participantId,
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
            numUsers,
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
 * Scrapes participation statistics from a Moodle forum activity.
 *
 * This function collects data from multiple forum-related pages including
 * - Main forum page (to extract forum ID)
 * - Subscriptions page (to count subscribed users)
 * - Forum report page (to gather per-participant activity stats)
 *
 * It compiles participant metrics such as posts, replies, views, word count, and timestamps
 * of earliest and most recent posts, and returns them in a structured `Forum` object.
 *
 * @param id - The unique identifier of the forum activity.
 * @param activityName - The display name of the forum as shown in the course.
 * @param numViews - The total number of views for the forum.
 * @param numUsers - The number of unique users who viewed the forum.
 * @param lastAccess - The timestamp (in milliseconds) of the last recorded access to the forum.
 * @param totalParticipants - The total number of course participants (used for table rendering).
 * @param courseId - The unique identifier of the Moodle course.
 * @returns A promise that resolves to an array containing a single `Forum` object with participant data,
 *          or an empty array if scraping fails.
 */
export async function scrapeForums(
    id: number,
    activityName: string,
    numViews: number,
    numUsers: number,
    lastAccess: number | undefined,
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
            const anchor = nameCell?.querySelector('a');
            if (!anchor) continue;

            const nameNode = Array.from(anchor.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            const participantName = nameNode?.textContent?.trim() ?? '';

            const idMatch = anchor.getAttribute('href')?.match(/id=(\d+)/);
            if (!idMatch) {
                console.warn("User ID not found for participant:", participantName);
                continue;
            }
            const participantId = parseInt(idMatch[1]);

            const discussionsPosted = parseCellToInt(rowForum.querySelector('td.cell.c2'));
            const repliesPosted = parseCellToInt(rowForum.querySelector('td.cell.c3'));
            const views = parseCellToInt(rowForum.querySelector('td.cell.c5'));
            const wordCount = parseCellToInt(rowForum.querySelector('td.cell.c6'));

            const earliestRaw = rowForum.querySelector('td.cell.c8')?.textContent?.trim() ?? '';
            const mostRecentRaw = rowForum.querySelector('td.cell.c9')?.textContent?.trim() ?? '';

            const earliestPost = normalizeTimeToMillis(earliestRaw);
            const mostRecentPost = normalizeTimeToMillis(mostRecentRaw);

            if (discussionsPosted === 0 && repliesPosted === 0 && views === 0 && wordCount === 0) continue;

            const participantData: ForumParticipantData = {
                participantId,
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
            numUsers,
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
 * Scrapes all relevant data from a Moodle course, including participants and activity statistics.
 *
 * This function first gathers participant information from the participant page,
 * then parses the activity report page to extract and classify each activity
 * (e.g., forums, quizzes, choices, resources) based on its type.
 * For complex activities, additional scraping is performed to gather detailed statistics.
 *
 * @param courseId - The unique identifier of the Moodle course.
 * @param activityReportUrl - The URL of the course's activity report page.
 * @param participantsUrl - The URL of the course's participant page.
 * @param totalParticipants - The total number of participants enrolled in the course (used in report URLs).
 * @returns A promise that resolves to a `Course` object containing metadata, participants,
 *          and detailed activity data extracted from the course.
 */
export async function scrapeCourse(
    courseId: string,
    activityReportUrl: string,
    participantsUrl: string,
    totalParticipants: number
): Promise<Course> {

    const participants = await scrapeParticipants(participantsUrl);
    const numParticipantsTotal = participants.length;
    const numParticipantsActive = participants.filter(p => p.lastAccessToCourse !== undefined).length;

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
        if (!anchor) continue;

        const href = anchor?.getAttribute('href') ?? '';
        const activityName = anchor?.textContent?.trim() ?? '';
        const {numViews, numUsers} = parseViewsAndUsers(viewsCell?.textContent?.trim() ?? '');

        const durationMatch = lastAccessCell?.textContent?.match(/\(([^)]+)\)/);
        const relativeDuration = durationMatch?.[1]?.trim();
        const lastAccess = parseLastAccess(relativeDuration);

        const idMatch = href.match(/id=(\d+)/);
        if (!idMatch) continue;
        const id = parseInt(idMatch[1]);

        switch (true) {
            case href.includes('/mod/url/'):
                urlResources.push({activityName, numViews, numUsers, lastAccess});
                break;
            case href.includes('/mod/workshop/'):
                workshops.push({activityName, numViews, numUsers, lastAccess});
                break;
            case href.includes('/mod/resource/'):
                resources.push({activityName, numViews, numUsers, lastAccess});
                break;
            case href.includes('/mod/choice/'):
                const choiceResults = await scrapeChoices(id, activityName, numViews, numUsers, lastAccess);
                choices.push(...choiceResults);
                break;
            case href.includes('/mod/quiz/'):
                const quizResults = await scrapeQuizzes(id, activityName, numViews, numUsers, lastAccess, totalParticipants);
                quizzes.push(...quizResults);
                break;
            case href.includes('/mod/forum/'):
                const forumResults = await scrapeForums(id, activityName, numViews, numUsers, lastAccess, totalParticipants, courseId);
                forums.push(...forumResults);
                break;
        }
    }
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
