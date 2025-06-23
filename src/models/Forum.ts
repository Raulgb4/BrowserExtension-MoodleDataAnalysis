import { ActivityBase } from "./ActivityBase";

/**
 * Represents participation statistics for a single student in a forum activity.
 */
export interface ForumStudentData {
    /**
     * Full name of the student.
     */
    studentName: string;

    /**
     * Number of discussion threads started by the student.
     */
    discussionsPosted: number;

    /**
     * Number of replies posted by the student in existing threads.
     */
    repliesPosted: number;

    /**
     * Number of times the student viewed the forum or its posts.
     */
    views: number;

    /**
     * Total word count across all messages posted by the student.
     */
    wordCount: number;

    /**
     * Timestamp of the earliest post made by the student (as a string in Moodle
     * format, e.g. "Tuesday, 18 October 2022, 6:49 PM").
     */
    earliestPost: string;

    /**
     * Timestamp of the most recent post made by the student (as a string in Moodle
     * format, e.g. "Saturday, 14 January 2023, 1:09 AM").
     */
    mostRecentPost: string;
}

/**
 * Represents a forum activity in Moodle.
 * Inherits basic activity properties and includes forum-specific participation data.
 */
export interface Forum extends ActivityBase {
    /**
     * Internal identifier of the forum activity in Moodle.
     */
    forumId: number;

    /**
     * Total number of users subscribed to the forum.
     */
    subscriptions: number;

    /**
     * List of student participation statistics in the forum.
     */
    studentsStats: ForumStudentData[];
}
