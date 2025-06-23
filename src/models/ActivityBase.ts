/**
 * Represents the common structure shared by most Moodle activity types.
 * This base interface includes generic metrics such as the activity name,
 * number of views, and the last access time, as scraped from the Moodle DOM.
 */
export interface ActivityBase {
    /**
     * The name/title of the activity as it appears in Moodle.
     */
    activityName: string;

    /**
     * The number of times the activity has been viewed by a number of users.
     * Note: This is stored as a string because Moodle often displays
     * values like "5007 views by 171 users".
     */
    numViews: string;

    /**
     * The last time the activity was accessed by any student.
     * Also, a string to match the Moodle format (e.g., "Monday, 23 June 2025, 4:17 PM (28 mins 26 secs)").
     */
    lastAccess: string;
}

/**
 * Represents a URL resource (modtype_url) in a Moodle course.
 * These are typically external links provided by the teacher.
 */
export type URLResource = ActivityBase;

/**
 * Represents a Choice activity (modtype_choice) in Moodle,
 * where students select among predefined options.
 */
export type Choice = ActivityBase;

/**
 * Represents a Workshop activity (modtype_workshop),
 * used for peer-assessment in Moodle.
 */
export type Workshop = ActivityBase;

/**
 * Represents a static resource (modtype_resource),
 * such as a PDF or document uploaded to the course.
 */
export type Resource = ActivityBase;
