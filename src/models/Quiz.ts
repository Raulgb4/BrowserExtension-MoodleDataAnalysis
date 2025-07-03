/**
 * @file QuizStudentData.ts
 * @description Defines the structure of data representing an individual student's performance in a Moodle quiz.
 *
 * This interface is used to store quiz-specific statistics for each student, including their name,
 * the duration of their quiz attempt (normalized), and the grade they achieved.
 * It is populated through subscraping the quiz results page of a given Moodle course.
 *
 * @interface QuizParticipantData
 * @author Raúl García Balongo
 * @date 2025
 */

import {ActivityBase} from "./ActivityBase";

export interface QuizParticipantData {

    /**
     * Unique identifier for the participant.
     */
    participantId: number;

    /**
     * Email address of the participant.
     */
    email: string;

    /**
     * Full name of the student.
     */
    participantName: string;

    /**
     * Duration of the quiz attempt, as extracted from Moodle (e.g., "15 mins 32 secs").
     */
    duration?: number;

    /**
     * Grade obtained by the student, on a scale defined by the quiz.
     */
    grade: number;

    /**
     * Normalized grade obtained by the student (out of 10).
     */
    normalizedGrade: number;
}

/**
 * Represents a quiz activity in Moodle.
 * Extends the common base fields from ActivityBase and includes specific quiz details.
 */
export interface Quiz extends ActivityBase {
    /**
     * Internal Moodle identifier for the quiz.
     */
    id: number;

    /**
     * Maximum grade defined for this quiz (e.g. 1, 5, 10).
     */
    maxGrade: number;

    /**
     * List of students who attempted the quiz, along with their stats.
     */
    participantStats: QuizParticipantData[];
}
