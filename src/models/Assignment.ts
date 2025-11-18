/**
 * @file Assignment.ts
 * @description Defines the structure of data representing an individual student's performance in a Moodle assignment.
 *
 *
 * @interface AssignmentParticipantData
 * @author Raúl García Balongo
 * @date 2025
 */

import {ActivityBase} from "./ActivityBase";

export interface AssignmentParticipantData {

    /**
     * Unique identifier for the participant.
     */
    participantId: number;

    /**
     * Full name of the student.
     */
    participantName: string;

    /**
     * Grade obtained by the student, on a scale defined by the assignment.
     */
    grade: number;

    /**
     * Normalized grade obtained by the student (out of 10).
     */
    normalizedGrade?: number;
}
/**
 * Represents an assignment activity in Moodle.
 * Extends the common base fields from ActivityBase and includes specific assignment details.
 */
export interface Assignment extends ActivityBase {
    /**
     * Maximum grade defined for this assigment (e.g., 1, 5, 10).
     */
    maxGrade?: number;

    /**
     * List of students who attempted the assignment, along with their stats.
     */
    participantStats?: AssignmentParticipantData[];
}