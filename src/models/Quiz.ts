import { ActivityBase } from "./ActivityBase";

/**
 * Represents data about a student's performance in a quiz.
 */
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
