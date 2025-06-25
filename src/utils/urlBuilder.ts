import { MOODLE_BASE_URL_LOCAL, URLS } from "../config/constants";

const BASE = MOODLE_BASE_URL_LOCAL;

/**
 * Builds the full set of URLs required to scrape basic course-level data.
 *
 * @param courseId - The ID of the Moodle course to analyze.
 * @param totalStudents - Optional number of participants to set perPage in the URL.
 *                      If not provided, a default of 1000 is used.
 * @returns An object containing named URLs to scrape.
 *
 * Includes only URLs that can be built directly from the courseId.
 * Forum and quiz URLs will be extracted later from the course content page,
 * as they require specific forumId or quizId values not known at this stage.
 *
 * Note: This currently assumes you're working in a local Moodle environment.
 */
export function getScrapeUrls(courseId: string | number, totalStudents?:number): Record <string, string> {
    return {
        course: `${BASE}${URLS.COURSE(courseId)}`,
        participants: `${BASE}${URLS.PARTICIPANTS(courseId, totalStudents)}`,
        activityReport: `${BASE}${URLS.ACTIVITY_REPORT(courseId)}`,
    }
}