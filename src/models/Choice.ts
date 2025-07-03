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

import { ActivityBase } from "./ActivityBase";

/**
 * Represents a Moodle Choice activity with response statistics.
 */
export interface Choice extends ActivityBase {
    /**
     * Unique identifier of the choice activity in Moodle.
     */
    id: number;

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
}
