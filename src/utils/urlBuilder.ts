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

import {devlog} from "./devlog";

/** Base URLs for different Moodle environments (kept for reference/logs or tests) */
export const MOODLE_BASE_URL_LOCAL = "http://localhost:8080";
export const MOODLE_BASE_URL_PROD = "https://informatica.cv.uma.es";

/**
 * Returns the current origin (prod or local) without trailing slashes.
 * Using window.location.origin makes all builders environment-agnostic.
 * Accepts an optional Window for testability.
 */
export function getBaseUrl(win: Window = window): string {
    try {
        return win.location.origin.replace(/\/+$/, "");
    } catch (e) {
        devlog.warn("urlBuilder", "getBaseUrl: unable to read window.location.origin", {
            error: String(e),
        });
        // Safe fallback: keep PROD to avoid breaking official usage
        return MOODLE_BASE_URL_PROD;
    }
}

/** Mutable BASE value (initialized with getBaseUrl) */
let BASE = getBaseUrl();

/**
 * Allows overriding BASE with the origin of the active Moodle tab.
 * Call this from App.tsx after retrieving the active tab URL.
 */
export function setBaseUrl(origin: string) {
    try {
        BASE = new URL(origin).origin.replace(/\/+$/, "");
        devlog.info("urlBuilder", "setBaseUrl", {BASE});
    } catch (e) {
        devlog.warn("urlBuilder", "setBaseUrl: invalid origin, keeping previous BASE", {
            origin,
            error: String(e),
        });
    }
}

/** Expose BASE for internal use */
export function getCurrentBase(): string {
    return BASE;
}


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
            "/backup/view.php",
        ];

        const pathname = parsed.pathname;
        const isCoursePage = validPaths.includes(pathname);
        const courseId =
            parsed.searchParams.get("id") || parsed.searchParams.get("courseid");

        return {isCoursePage, courseId};
    } catch (e) {
        devlog.warn("urlBuilder", "extractMoodleCourseId: invalid URL", {
            url,
            error: String(e),
        });
        return {isCoursePage: false, courseId: null};
    }
}

/**
 * Parameterized route templates for constructing Moodle URLs dynamically.
 * These are relative paths that need to be prefixed with the BASE URL.
 */
export const URLS = {
    /** Main course view */
    COURSE: (id: string | number) => `/course/view.php?id=${id}`,

    /** Participants (with optional perPage override; default 1000) */
    PARTICIPANTS: (id: string | number, perPage?: number) =>
        `/user/index.php?id=${id}&perpage=${perPage ?? 1000}`,

    /** Grades report */
    GRADER_REPORT: (courseId: string | number) =>
        `/grade/report/grader/index.php?id=${courseId}&report=grader&perpage=0`,

    /** Gradebook setup */
    GRADEBOOK_SETUP: (courseId: string | number) =>
        `/grade/edit/tree/index.php?id=${courseId}`,

    /** Activity report */
    ACTIVITY_REPORT: (id: string | number) => `/report/outline/index.php?id=${id}`,

    /** Choice results */
    CHOICE_RESULTS: (id: string | number) => `/mod/choice/report.php?id=${id}`,

    /** Quiz overview (with optional page size; default 1000) */
    QUIZ_RESULTS: (id: string | number, pageSize?: number) =>
        `/mod/quiz/report.php?id=${id}&mode=overview&pagesize=${pageSize ?? 1000}`,

    /** Forum main */
    FORUM_MAIN: (id: string | number) => `/mod/forum/view.php?id=${id}`,

    /** Forum reports summary */
    FORUM_REPORTS: (id: string | number, forumId: string | number, perPage?: number) =>
        `/mod/forum/report/summary/index.php?courseid=${id}&forumid=${forumId}&perpage=${perPage ?? 1000}`,

    /** Forum subscriptions */
    FORUM_SUBSCRIPTIONS: (forumId: string | number) =>
        `/mod/forum/subscribers.php?id=${forumId}`,
};

/** Builders (unchanged API; only BASE is now dynamic) */
export function getScrapeUrlCourseMain(courseId: string | number): Record<string, string> {
    return {courseMain: `${BASE}${URLS.COURSE(courseId)}`};
}

export function getScrapeUrlParticipants(
    courseId: string | number,
    totalParticipants?: number
): Record<string, string> {
    return {participants: `${BASE}${URLS.PARTICIPANTS(courseId, totalParticipants)}`};
}

export function getScrapeUrlGraderReport(courseId: string | number): Record<string, string> {
    return {graderReport: `${BASE}${URLS.GRADER_REPORT(courseId)}`};
}

export function getScrapeUrlGradebookSetup(courseId: string | number): Record<string, string> {
    return {gradebookSetup: `${BASE}${URLS.GRADEBOOK_SETUP(courseId)}`};
}

export function getScrapeUrlActivityReport(courseId: string | number): Record<string, string> {
    return {activityReport: `${BASE}${URLS.ACTIVITY_REPORT(courseId)}`};
}

export function getScrapeUrlChoice(id: string | number): Record<string, string> {
    return {choiceResults: `${BASE}${URLS.CHOICE_RESULTS(id)}`};
}

export function getScrapeUrlQuiz(
    id: string | number,
    totalParticipants?: number
): Record<string, string> {
    return {quizResults: `${BASE}${URLS.QUIZ_RESULTS(id, totalParticipants)}`};
}

export function getScrapeUrlForumMain(id: string | number): Record<string, string> {
    return {forumMain: `${BASE}${URLS.FORUM_MAIN(id)}`};
}

export function getScrapeUrlForumReports(
    courseId: string | number,
    forumId: string | number,
    totalParticipants?: number
): Record<string, string> {
    return {
        forumReports: `${BASE}${URLS.FORUM_REPORTS(courseId, forumId, totalParticipants)}`,
    };
}

export function getScrapeUrlForumSubscriptions(
    forumId: string | number
): Record<string, string> {
    return {forumSubscriptions: `${BASE}${URLS.FORUM_SUBSCRIPTIONS(forumId)}`};
}


