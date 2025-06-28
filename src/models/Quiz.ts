/**
 * @file QuizStudentData.ts
 * @description Defines the structure of data representing an individual student's performance in a Moodle quiz.
 *
 * This interface is used to store quiz-specific statistics for each student, including their name,
 * the duration of their quiz attempt (normalized), and the grade they achieved.
 * It is populated through subscraping the quiz results page of a given Moodle course.
 *
 * @interface QuizStudentData
 * @author Raúl García Balongo
 * @date 2025
 */

import {ActivityBase} from "./ActivityBase";

export interface QuizStudentData {
    /**
     * Full name of the student.
     */
    studentName: string;

    /**
     * Duration of the quiz attempt, as extracted from Moodle (e.g., "15 mins 32 secs").
     */
    duration: string;

    /**
     * Grade obtained by the student, on a scale defined by the quiz (usually out of 1.00).
     */
    grade: number;
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
     * List of students who attempted the quiz, along with their stats.
     */
    studentStats: QuizStudentData[];
}
