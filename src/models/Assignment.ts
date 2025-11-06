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
}
/**
 * Represents a assignment activity in Moodle.
 * Extends the common base fields from ActivityBase and includes specific assignment details.
 */
export interface Assignment extends ActivityBase {

    /**
     * List of students who attempted the assignment, along with their stats.
     */
    participantStats?: AssignmentParticipantData[];
}