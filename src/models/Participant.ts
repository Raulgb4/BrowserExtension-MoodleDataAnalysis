/**
 * @file Participant.ts
 * @description Defines the structure of a participant enrolled in a Moodle course.
 *
 * This interface represents the key details extracted for each user enrolled in a course,
 * including their full name, assigned role, group affiliations, last access information,
 * and current status. It is used by the extension to organize and analyze participation data
 * scraped from the Moodle participants page.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

export interface Participant {

    /**
     * Unique identifier for the participant.
     */
    id: number;

    /**
     * Email address of the participant.
     */
    email: string;

    /**
     * Full name of the participant.
     */
    participantName?: string;

    /**
     * List of roles assigned in the course (e.g., ["Student", "Teacher"]).
     */
    roles?: string[];

    /**
     * List of groups the participant belongs to (e.g., ["GR 1 (INF A)", "Gr. Informática (Grupo A)"]).
     */
    groups?: string[];

    /**
     * Last access duration in ms.
     */
    lastAccessToCourse?: number;

    /**
     * Registration of the participant (e.g., "Movilidad", "Manual enrolments").
     */
    registration?: string;
}
