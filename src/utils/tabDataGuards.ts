/**
 * @file tabDataGuards.ts
 *
 * @description
 * Utility functions for determining whether each tab in the extension should be displayed
 * based on the presence of relevant data in the current course object stored in chrome.storage.local.
 *
 * Includes:
 * - A helper to retrieve the currently active course data from storage.
 * - Predicate functions (`hasData*`) for each tab to check if the required data is available.
 *
 * These guards are used in TabSection to dynamically show or hide tabs, ensuring that empty tabs
 * (with no meaningful data to display) are not rendered in the UI.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

/**
 * Retrieves the current course object from chrome.storage.local.
 * The course is identified by the first key starting with "course_".
 *
 * @returns A promise that resolves with the course object or null if no course is found.
 */
export async function getCurrentCourse(): Promise<any | null> {
    const all = await chrome.storage.local.get(null);
    const courseKey = Object.keys(all).find((k) => k.startsWith("course_"));
    return courseKey ? all[courseKey] : null;
}

/**
 * Checks if the Global tab should be displayed.
 * Global is always visible regardless of course data.
 *
 * @param _course - The course object (not used in this check).
 * @returns Always true.
 */
export const hasDataGlobal = (_course: any) => true;

/**
 * Checks if the Participants tab has data.
 *
 * @param course - The course object from storage.
 * @returns True if the participants array exists and has at least one entry.
 */
export const hasDataParticipants = (course: any) =>
    Array.isArray(course?.participants) && course.participants.length > 0;

/**
 * Choices: align with ChoicesTab logic.
 * We consider there is data if at least one choice has non-empty responseCounts.
 */
export const hasDataChoices = (course: any) =>
    Array.isArray(course?.choices) &&
    course.choices.some(
        (c: any) =>
            c?.responseCounts &&
            typeof c.responseCounts === "object" &&
            Object.keys(c.responseCounts).length > 0
    );

/**
 * Quizzes: as before, participantStats must exist and have length > 0.
 */
export const hasDataQuizzes = (course: any) =>
    Array.isArray(course?.quizzes) &&
    course.quizzes.some(
        (q: any) => Array.isArray(q?.participantStats) && q.participantStats.length > 0
    );

/**
 * Forums: be tolerant with schema differences.
 * We detect data if any common collection/count field shows content.
 */
export const hasDataForums = (course: any) =>
    Array.isArray(course?.forums) &&
    course.forums.some((f: any) => {
        const candidates = [
            Array.isArray(f?.discussions) ? f.discussions.length : 0,
            Array.isArray(f?.posts) ? f.posts.length : 0,
            Array.isArray(f?.topics) ? f.topics.length : 0,
            typeof f?.totalPosts === "number" ? f.totalPosts : 0,
            typeof f?.numPosts === "number" ? f.numPosts : 0,
            typeof f?.numViews === "number" ? f.numViews : 0,
        ];
        return candidates.some((n) => n > 0);
    });


/**
 * Checks if the Other Activities tab has data.
 *
 * @param course - The course object from storage.
 * @returns True if there is at least one URL resource, file resource, or workshop.
 */
export const hasDataOtherActivities = (course: any) => {
    const urlRes = Array.isArray(course?.urlResources) && course.urlResources.length > 0;
    const files = Array.isArray(course?.resources) && course.resources.length > 0;
    const workshops = Array.isArray(course?.workshops) && course.workshops.length > 0;
    return urlRes || files || workshops;
};

/**
 * Checks if the Correlations tab has data.
 *
 * @param course - The course object from storage.
 * @returns True if there is at least one URL resource, file resource, or workshop.
 */
export const hasDataCorrelations = (course: any) => {

    const hasDataWorkshops = Array.isArray(course?.workshops) && course.workshops.length > 0;
    return hasDataWorkshops || hasDataChoices(course) || hasDataParticipants(course) ;
};
