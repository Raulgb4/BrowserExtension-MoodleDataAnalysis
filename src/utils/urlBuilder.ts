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
export const MOODLE_BASE_URL_PROD = "https://informatica.cv.uma.es";

/**
 * Base URL currently in use.
 *
 * NOTE: You can switch between local and production by updating this variable.
 * In the future, this could be made dynamic or configurable via chrome.storage.
 */
const BASE = MOODLE_BASE_URL_LOCAL;


/**
 * Regular expression to detect whether the current tab is displaying
 * the main page of a Moodle course.
 *
 * This is typically used to trigger the extension logic only when the user
 * is viewing a course overview page.
 *
 * Example matches:
 * - http://localhost:8080/course/view.php?id=2
 * - https://informatica.cv.uma.es/course/view.php?id=4814
 */
export const COURSE_PAGE_REGEX = /\/course\/view\.php\?id=\d+$/;


/**
 * Dynamically determines the base URL for Moodle depending on the current tab.
 *
 * This is useful to automatically switch between local and production environments
 * without manual changes in the code.
 *
 * @param fullUrl - The full URL of the current Moodle page.
 * @returns The base URL including protocol and hostname, without trailing slash.
 */
export function getBaseUrl(fullUrl: string): string {
    try {
        const url = new URL(fullUrl);

        switch (url.hostname) {
            case "localhost":
                return "http://localhost:8080";
            case "informatica.cv.uma.es":
                return "https://informatica.cv.uma.es";
            default:
                console.warn(`Unrecognized Moodle host: ${url.hostname}`);
                return `${url.protocol}//${url.host}`; // fallback
        }
    } catch (e) {
        console.error("Invalid URL passed to getBaseUrl():", fullUrl);
        return ""; // or throw error
    }
}


/**
 * Parameterized route templates for constructing Moodle URLs dynamically.
 * These are relative paths that need to be prefixed with the BASE URL.
 */
export const URLS = {

    /**
     * Returns the path to the main course view page.
     * @param id Course ID
     */
    COURSE: (id: string | number) =>
        `/course/view.php?id=${id}`,

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
 * Generates the full set of scraping URLs required for a given course.
 * This function returns absolute URLs, combining the base URL and
 * the appropriate route templates from the URLs object.
 *
 * This is used by the extension to access core Moodle pages like:
 * - Course homepage
 * - Participants list
 * - Activity report
 *
 * @param courseId - The ID of the Moodle course to scrape.
 * @param totalParticipants - Optional participant count used to override pagination.
 *
 * @returns An object mapping logical names (e.g., "course", "participants") to full URLs.
 */
export function getScrapeUrls(courseId: string | number, totalParticipants?: number): Record<string, string> {
    return {
        course: `${BASE}${URLS.COURSE(courseId)}`,
        participants: `${BASE}${URLS.PARTICIPANTS(courseId, totalParticipants)}`,
        activityReport: `${BASE}${URLS.ACTIVITY_REPORT(courseId)}`
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

export function getScrapeUrlForumReports(courseId: string | number, forumId: string | number, totalParticipants?: number): Record<string, string> {
    return {
        forumReports: `${BASE}${URLS.FORUM_REPORTS(courseId, forumId, totalParticipants)}`,
    };
}

export function getScrapeUrlForumSubscriptions(forumId: string | number): Record<string, string> {
    return {
        forumSubscriptions: `${BASE}${URLS.FORUM_SUBSCRIPTIONS(forumId)}`,
    };
}
