/**
 * @file ActivityBase.ts
 * @description Defines the base interface representing the common structure shared by most Moodle activity types.
 *
 * This interface is intended to be extended by specific activity models (e.g., Quiz, Choice, Forum)
 * and includes generic fields such as the activity name, number of views, and last access date.
 * These values are typically extracted from the Moodle Activity Report DOM.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

export interface ActivityBase {
    /**
     * The name/title of the activity as it appears in Moodle.
     */
    activityName: string;

    /**
     * Total number of views for this activity.
     * Example: "180 views by 86 users" → 180
     */
    numViews: number;

    /**
     * Number of unique users who viewed this activity.
     * Example: "180 views by 86 users" → 86
     */
    numUsers: number;

    /**
     * The last time any student accessed the activity.
     * Also, a string to match the Moodle format (e.g., "Monday, 23 June 2025, 4:17 PM (28 mins 26 secs)" -> (28 mins 26 secs) -> ms).
     */
    lastAccess?: number;
}

/**
 * Represents a URL resource (modtype_url) in a Moodle course.
 * These are typically external links provided by the teacher.
 */
export type URLResource = ActivityBase;

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
