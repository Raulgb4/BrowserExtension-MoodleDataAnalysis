/**
 * @file Forum.ts
 * @description Contains interfaces for representing forum-related data within a Moodle course.
 *
 * This module defines the `Forum` interface, which extends common activity fields and includes
 * forum-specific metrics such as forum ID, number of subscriptions, and detailed student participation stats.
 * It also defines `ForumStudentData`, used to capture individual student contributions.
 *
 * These structures are used during the scraping process to model forum engagement data for further analysis
 * and visualization by the extension.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {ActivityBase} from "./ActivityBase";

export interface ForumParticipantData {

    /**
     * Unique identifier for the participant.
     */
    participantId: number;

    /**
     * Full name of the student.
     */
    participantName: string;

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
     * Timestamp of the earliest post made by the student (in ISO 8601 format).
     * Example: "2022-10-18T18:49:00"
     */
    earliestPost: number | undefined;

    /**
     * Timestamp of the most recent post made by the student (in ISO 8601 format).
     * Example: "2023-01-14T01:09:00"
     */
    mostRecentPost: number | undefined;
}

/**
 * Represents a forum activity in Moodle.
 * Inherits basic activity properties and includes forum-specific participation data.
 */
export interface Forum extends ActivityBase {
    /**
     * Internal identifier of the forum activity in Moodle (Subscriptions and Reports pages).
     */
    forumId: number;

    /**
     * Total number of users subscribed to the forum.
     */
    subscriptions: number;

    /**
     * List of student participation statistics in the forum.
     */
    participantsStats: ForumParticipantData[];
}
