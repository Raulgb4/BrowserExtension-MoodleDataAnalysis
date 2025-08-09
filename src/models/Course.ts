/**
 * @file Course.ts
 * @description Defines the `Course` interface representing a Moodle course and its associated data.
 *
 * A `Course` object encapsulates the complete set of scraped information for a single Moodle course,
 * including participants and different types of activities such as URL resources, choices, workshops,
 * files, quizzes, and forums. This interface serves as the top-level structure used for data aggregation
 * and further analysis or visualization within the extension.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {Resource, URLResource, Workshop} from './ActivityBase';
import {Quiz} from './Quiz';
import {Forum} from './Forum';
import {Choice} from './Choice';
import {Participant} from './Participant';

export interface Course {
    /**
     * Unique identifier of the course (corresponds to the `id` parameter in the Moodle URL).
     */
    id: number;

    /**
     * Name of the course, as extracted from the Moodle page.
     */
    courseName: string;

    /**
     * List of URL-based resources (modtype_url).
     */
    urlResources: URLResource[];

    /**
     * List of file-based resources (modtype_resource).
     */
    resources: Resource[];

    /**
     * List of choice activities (modtype_choice).
     */
    choices: Choice[];

    /**
     * List of workshop activities (modtype_workshop).
     */
    workshops: Workshop[];

    /**
     * List of quiz activities (modtype_quiz), including detailed student performance.
     */
    quizzes: Quiz[];

    /**
     * List of forum activities (modtype_forum), including detailed student participation data.
     */
    forums: Forum[];

    /**
     * List of participants enrolled in the course, with metadata such as role, group, and last access.
     */
    participants: Participant[];

    /**
     * Total number of participants in the course.
     */
    numParticipantsTotal: number;
}