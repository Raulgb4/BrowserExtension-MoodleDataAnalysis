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
     * Grade obtained by the student submission (Entrega).
     */
    // Nota de la entrega                                  (submissionGrade)    (Hay que scrapearla del grader report)
    submissionGrade: number;

    /**
     * Grade obtained by the student assessment (Evaluación).
     */
    // Nota de la evaluación                               (assessmentGrade)    (Es el actual grade)
    assessmentGrade: number;

    /**
     * Grade obtained by the student, on a scale defined by the workshop (Total).
     */
    // Nota total                                          (grade)              (Nuevo campo calculado)
    grade: number;

    /**
     * Normalized grade obtained by the student (Total normalizada 0-10).
     */
    // Nota normalizada (debe ser sobre 10)                (normalizedGrade)    (Campo calculado)
    normalizedGrade: number;
}
/**
 * Represents a workshop activity in Moodle.
 * Extends the common base fields from ActivityBase and includes specific workshop details.
 */
export interface Workshop extends ActivityBase {
    /**
     * Maximum submission grade defined for this workshop.
     */
    // Nota máxima de la entrega (Normalmente sobre 80)    (maxSubmissionGrade) (Hay que scrapearla del gradebook setup)
    maxSubmissionGrade?: number;

    /**
     * Maximum assessment grade defined for this workshop.
     */
    // Nota máxima de la evaluación (Normalmente sobre 20) (maxAssessmentGrade) (Es el actual maxGrade)
    maxAssessmentGrade?: number;

    /**
     * Maximum grade defined for this workshop (e.g., 1, 5, 10).
     */
    // Nota máxima del taller (Normalmente sobre 100)      (maxGrade)           (Nuevo campo calculado)
    //                                                          |
    //                                                          v
    //                                       maxSubmissionGrade + maxAssessmentGrade
    maxGrade?: number;

    /**
     * List of students who attempted the workshop, along with their stats.
     */
    participantStats?: WorkshopParticipantData[];
}