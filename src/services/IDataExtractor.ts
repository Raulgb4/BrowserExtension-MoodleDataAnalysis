/**
 * @file IDataExtractor.ts
 * @description Interface definition for scraping Moodle course data.
 * Both production and local implementations must comply with this contract.
 *
 * @author
 * Raúl García Balongo
 * @date 2025
 */

// ---- Models ----
import {Participant} from "../models/Participant";
import {Quiz} from "../models/Quiz";
import {Forum} from "../models/Forum";
import {Choice} from "../models/Choice";
import {Course} from "../models/Course";

/**
 * Progress tracker used during long-running scraping operations.
 * Implementations can use it to update a progress bar or loader in the UI.
 */
export type AnalysisProgress = {
    start: (label?: string) => void;
    setTotal: (n: number) => void;
    tick: (inc?: number) => void;
    setLabel: (label: string) => void;
    complete: () => void;
};

/**
 * Common interface for all data extractor implementations (prod/local).
 * Each method corresponds to a scraping operation that retrieves data
 * from a specific Moodle course section.
 */
export interface IDataExtractor {
    /**
     * Scrapes the total number of participants from the given participants URL.
     */
    scrapeNumParticipants(participantsUrl: string): Promise<number | null>;

    /**
     * Scrapes the list of participants from the given participants URL.
     */
    scrapeParticipants(participantsUrl: string): Promise<Participant[]>;

    /**
     * Scrapes the course main page and retrieves the course name or identifier.
     */
    scrapeCourseMain(courseMainUrl: string): Promise<string>;

    /**
     * Scrapes all Choice activities within a course.
     */
    scrapeChoices(
        id: number,
        activityName: string,
        numViews: number,
        numUsers: number,
        lastAccess: number | undefined
    ): Promise<Choice[]>;

    /**
     * Scrapes all Quiz activities within a course.
     */
    scrapeQuizzes(
        id: number,
        activityName: string,
        numViews: number,
        numUsers: number,
        lastAccess: number | undefined,
        totalParticipants: number
    ): Promise<Quiz[]>;

    /**
     * Scrapes all Forum activities within a course.
     */
    scrapeForums(
        id: number,
        activityName: string,
        numViews: number,
        numUsers: number,
        lastAccess: number | undefined,
        totalParticipants: number,
        courseId: string
    ): Promise<Forum[]>;

    /**
     * Orchestrates the scraping of a full course, including its metadata
     * and all activities (participants, quizzes, forums, choices, etc.).
     */
    scrapeCourse(
        courseId: string,
        courseMainUrl: string,
        activityReportUrl: string,
        participantsUrl: string,
        totalParticipants: number,
        progress?: AnalysisProgress
    ): Promise<Course>;
}
