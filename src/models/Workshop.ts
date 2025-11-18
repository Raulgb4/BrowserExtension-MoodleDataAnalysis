/**
 * @file Workshop.ts
 * @description Defines the structure of data representing an individual student's performance in a Moodle workshop.
 *
 *
 * @interface WorkshopParticipantData
 * @author Raúl García Balongo
 * @date 2025
 */

import {ActivityBase} from "./ActivityBase";

export interface WorkshopParticipantData {

    /**
     * Unique identifier for the participant.
     */
    participantId: number;

    /**
     * Full name of the student.
     */
    participantName: string;

    /**
     * Grade obtained by the student, on a scale defined by the workshop.
     */
    grade: number;

    /**
     * Normalized grade obtained by the student (out of 10).
     */
    normalizedGrade?: number;
}
/**
 * Represents a workshop activity in Moodle.
 * Extends the common base fields from ActivityBase and includes specific workshop details.
 */
export interface Workshop extends ActivityBase {
    /**
     * Maximum grade defined for this workshop (e.g., 1, 5, 10).
     */
    maxGrade?: number;

    /**
     * List of students who attempted the workshop, along with their stats.
     */
    participantStats?: WorkshopParticipantData[];
}