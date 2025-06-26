/**
 * constants.ts
 *
 * This file centralizes constant values used across the Moodle Data Analysis
 * browser extension project. It includes base URLs, route templates for scraping,
 * regular expressions for URL detection, and default pagination settings.
 *
 * Author: Raúl García Balongo
 * Date: 2025
 */

/** Base URLs for different Moodle environments */
export const MOODLE_BASE_URL_LOCAL = "http://localhost:8080";
export const MOODLE_BASE_URL_PROD = "https://informatica.cv.uma.es";

/**
 * Regular expression to detect if the current tab is showing
 * the main page of a Moodle course.
 *
 * Example matches:
 * - http://localhost:8080/course/view.php?id=2
 * - https://informatica.cv.uma.es/course/view.php?id=4814
 */
export const COURSE_PAGE_REGEX = /\/course\/view\.php\?id=\d+$/;

/**
 * Route templates for building Moodle URLs programmatically.
 * These are used during scraping or link generation.
 */
export const URLS = {
    /**
     * Main course page
     * @param id Course ID
     * @returns Full path to the course view page
     */
    COURSE: (id: string | number) =>
        `/course/view.php?id=${id}`,

    /**
     * Participants page with pagination override
     * @param id Course ID
     * @param perPage Optional override of participants per page
     */
    PARTICIPANTS: (id: string | number, perPage?: number) =>
        `/user/index.php?id=${id}&perpage=${perPage ?? 1000}`,

    /**
     * Activity report page
     * @param id Course ID
     */
    ACTIVITY_REPORT: (id: string | number) =>
        `/report/outline/index.php?id=${id}`,

    /**
     * Quiz results page with pagination override
     * @param id Quiz ID
     * @param pageSize Optional override of quiz attempts page size
     */
    QUIZ_RESULTS: (id: string | number, pageSize?: number) =>
        `/mod/quiz/report.php?id=${id}&mode=overview&pagesize=${pageSize ?? 1000}`,


    /**
     * Forum report page with pagination override
     * @param id Course ID
     * @param perPage Optional override of forum messages per page
     * @param forumId
     */
    FORUM_REPORT: (id: string | number, forumId : string | number, perPage?: number) =>
        `/mod/forum/report/summary/index.php?courseid=${id}&forumid=${forumId}&perpage=${perPage ?? 1000}`,
};
