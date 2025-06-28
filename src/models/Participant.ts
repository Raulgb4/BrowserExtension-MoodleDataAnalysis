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
     * Full name of the participant.
     */
    participantName: string;

    /**
     * Role assigned in the course (e.g., "Student", "Teacher").
     */
    role: string;

    /**
     * Group to which the participant belongs, if applicable (e.g., "GR 2 (COM A/INF D/SOF D), Gr. Computadores (Grupo A)").
     */
    group: string;

    /**
     * Last access timestamp to the course (as a string in Moodle format, e.g., "Never" or "1 day 20 hours").
     */
    lastAccessToCourse: string;

    /**
     * Status of the participant (e.g., "Active", "Not current").
     */
    status: string;
}
