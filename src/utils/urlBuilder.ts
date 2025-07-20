/**
 * @file urlBuilder.ts
 * @description Centralized module for constructing and managing Moodle-related URLs
 * used throughout the browser extension for scraping course data and reports.
 *
 * Provides utility functions to generate absolute paths for:
 * - Course homepage
 * - Participants list
 * - Activity reports
 * - Quiz and forum endpoints
 *
 * @author Raúl García Balongo
 * @date 2025
 */

/** Base URLs for different Moodle environments */
export const MOODLE_BASE_URL_LOCAL = "http://localhost:8080";
//export const MOODLE_BASE_URL_PROD = "https://informatica.cv.uma.es";

/**
 * Base URL currently in use.
 *
 * NOTE: You can switch between local and production by updating this variable.
 * In the future, this could be made dynamic or configurable via chrome.storage.
 */
const BASE = MOODLE_BASE_URL_LOCAL;

/**
 * Checks if a given URL belongs to a Moodle course-related section
 * and extracts the associated course ID if present.
 *
 * @param url - The full Moodle page URL.
 * @returns An object indicating if it's a valid course page and the course ID (if found).
 */
export function extractMoodleCourseId(url: string): {
    isCoursePage: boolean;
    courseId: string | null;
} {
    try {
        const parsed = new URL(url);
        const validPaths = [
            "/course/view.php",
            "/course/edit.php",
            "/user/index.php",
            "/grade/report/grader/index.php",
            "/course/overview.php",
            "/report/outline/index.php",
            "/report/view.php",
            "/question/banks.php",
            "/course/completion.php",
            "/badges/index.php",
            "/admin/tool/lp/coursecompetencies.php",
            "/mod/lti/coursetools.php",
            "/backup/view.php"
        ];

        const isCoursePage = validPaths.includes(parsed.pathname);
        const courseId = parsed.searchParams.get("id") || parsed.searchParams.get("courseid");

        return {isCoursePage, courseId};
    } catch {
        console.warn("Invalid URL:", url);
        return {isCoursePage: false, courseId: null};
    }
}


/**
 * Parameterized route templates for constructing Moodle URLs dynamically.
 * These are relative paths that need to be prefixed with the BASE URL.
 */
export const URLS = {

    /**
     * Returns the path to the participant list with optional pagination override.
     * @param id Course ID
     * @param perPage Number of participants to show per page (default: 1000)
     */
    PARTICIPANTS: (id: string | number, perPage?: number) =>
        `/user/index.php?id=${id}&perpage=${perPage ?? 1000}`,

    /**
     * Returns the path to the activity report page for the given course.
     * @param id Course ID
     */
    ACTIVITY_REPORT: (id: string | number) =>
        `/report/outline/index.php?id=${id}`,

    /**
     * Returns the path to the choice results overview page.
     * @param id Choice ID
     */
    CHOICE_RESULTS: (id: string | number) =>
        `/mod/choice/report.php?id=${id}`,

    /**
     * Returns the path to the quiz results overview page.
     * @param id Quiz ID
     * @param pageSize Number of attempts per page (default: 1000)
     */
    QUIZ_RESULTS: (id: string | number, pageSize?: number) =>
        `/mod/quiz/report.php?id=${id}&mode=overview&pagesize=${pageSize ?? 1000}`,

    /**
     * Returns the path to a forum participation summary report.
     * @param id main forum ID
     */
    FORUM_MAIN: (id: string | number) =>
        `/mod/forum/view.php?id=${id}`,


    /**
     * Returns the path to a forum participation summary report.
     * @param id Course ID
     * @param forumId Forum ID
     * @param perPage Number of posts per page (default: 1000)
     */
    FORUM_REPORTS: (id: string | number, forumId: string | number, perPage?: number) =>
        `/mod/forum/report/summary/index.php?courseid=${id}&forumid=${forumId}&perpage=${perPage ?? 1000}`,

    /**
     * Returns the path to a forum participation summary report.
     * @param forumId Forum ID
     */
    FORUM_SUBSCRIPTIONS: (forumId: string | number) =>
        `/mod/forum/subscribers.php?id=${forumId}`,


};

/**
 * Generates the URL for the participant list of a course.
 *
 * @param courseId - The ID of the Moodle course.
 * @param totalParticipants - Optional. Number of participants to include per page.
 * @returns An object with `participants` key mapping to the full participants list URL.
 */
export function getScrapeUrlParticipants(courseId: string | number, totalParticipants?: number): Record<string,
    string> {
    return {
        participants: `${BASE}${URLS.PARTICIPANTS(courseId, totalParticipants)}`,
    };
}

/**
 * Generates the URL for the activity report page of a course.
 *
 * @param courseId - The ID of the Moodle course.
 * @returns An object with an `activityReport` key mapping to the full activity report URL.
 */
export function getScrapeUrlActivityReport(courseId: string | number): Record<string, string> {
    return {
        activityReport: `${BASE}${URLS.ACTIVITY_REPORT(courseId)}`,
    };
}

/**
 * Generates the URL used to access the choice results page for a specific choice activity.
 *
 * @param id - The ID of the choice activity.
 * @returns An object with a `choiceResults` key mapping to the full quiz results URL.
 */
export function getScrapeUrlChoice(id: string | number): Record<string, string> {
    return {
        choiceResults: `${BASE}${URLS.CHOICE_RESULTS(id)}`,
    };
}

/**
 * Generates the URL used to access the quiz results page for a specific quiz activity.
 *
 * This is used to scrape individual student quiz data, such as names,
 * durations, and grades.
 *
 * @param id - The ID of the quiz activity.
 * @param totalParticipants - Optional. Ensures all student attempts are visible on one page.
 * @returns An object with a `quizResults` key mapping to the full quiz results URL.
 */
export function getScrapeUrlQuiz(id: string | number, totalParticipants?: number): Record<string, string> {
    return {
        quizResults: `${BASE}${URLS.QUIZ_RESULTS(id, totalParticipants)}`,
    };
}

/**
 * Generates the URL used to access the main page of a specific forum.
 *
 * This is intended for scraping forum-level data such as discussions
 * and participation metrics. Currently only returns the forum overview page.
 *
 * @param id - The ID of the forum activity.
 * @returns An object with a `forumMain` key mapping to the full forum main page URL.
 */
export function getScrapeUrlForumMain(id: string | number): Record<string, string> {
    return {
        forumMain: `${BASE}${URLS.FORUM_MAIN(id)}`,
    };
}

/**
 * Generates the URL used to access the forum reports page for a specific course and forum.
 *
 * This URL provides detailed statistical information about forum participation, such as
 *  the number of posts, replies, views, and word counts for each user.
 *
 * @param courseId - The unique identifier of the course containing the forum.
 * @param forumId - The unique identifier of the forum activity.
 * @param totalParticipants - (Optional) Total number of course participants, used to construct the report URL.
 * @returns An object containing the `forumReports` key with the full URL to the forum report page.
 */
export function getScrapeUrlForumReports(courseId: string | number, forumId: string | number,
                                         totalParticipants?: number): Record<string, string> {
    return {
        forumReports: `${BASE}${URLS.FORUM_REPORTS(courseId, forumId, totalParticipants)}`,
    };
}

/**
 * Generates the URL used to access the subscription page of a specific forum.
 *
 * This URL is used to determine how many users are subscribed to the forum,
 * which can be useful for analyzing engagement levels.
 *
 * @param forumId - The unique identifier of the forum activity.
 * @returns An object containing the `forumSubscriptions` key with the full URL to the forum subscriptions page.
 */
export function getScrapeUrlForumSubscriptions(forumId: string | number): Record<string, string> {
    return {
        forumSubscriptions: `${BASE}${URLS.FORUM_SUBSCRIPTIONS(forumId)}`,
    };
}
