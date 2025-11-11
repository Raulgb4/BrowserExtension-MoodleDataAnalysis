/**
 * @file Choice.ts
 * @description
 * Interface representing a Choice activity in Moodle, including its unique ID
 * and a mapping of response options to the number of participants who selected each one.
 *
 * Used for analyzing how students respond to choice-based activities.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {ActivityBase} from "./ActivityBase";

export interface ChoiceParticipantData {

    /**
     * Unique identifier for the participant.
     */
    participantId: number;

    /**
     * Full name of the student.
     */
    participantName: string;
}

/**
 * Represents a Moodle Choice activity with response statistics.
 */
export interface Choice extends ActivityBase {
    /**
     * A dictionary mapping each response option (e.g., "Yes", "No", "Maybe")
     * to the number of participants who selected that option.
     *
     * Example:
     * {
     *   "Yes": 42,
     *   "No": 15,
     *   "Maybe": 3
     * }
     */
    responseCounts: Record<string, number>;

    /**
     * List of students who attempted the quiz, along with their stats.
     */
    participantStats: ChoiceParticipantData[];
}
