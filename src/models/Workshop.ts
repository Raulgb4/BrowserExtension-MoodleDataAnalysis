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
}
/**
 * Represents a workshop activity in Moodle.
 * Extends the common base fields from ActivityBase and includes specific workshop details.
 */
export interface Workshop extends ActivityBase {

    /**
     * List of students who attempted the workshop, along with their stats.
     */
    participantStats?: WorkshopParticipantData[];
}