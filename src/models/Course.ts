import { URLResource, Choice, Workshop, Resource } from './ActivityBase';
import { Quiz } from './Quiz';
import { Forum } from './Forum';
import { Participant } from './Participant';

/**
 * Represents a Moodle course (subject) with its associated activities and participants.
 */
export interface Course {
    /**
     * Unique identifier of the course (corresponds to the `id` parameter in the Moodle URL).
     */
    id: number;

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

    /**
     * Number of participants considered active based on criteria such as recent access or quiz attempts.
     */
    numParticipantsActive: number;
}