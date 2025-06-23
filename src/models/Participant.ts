/**
 * Represents a participant enrolled in a Moodle course.
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
