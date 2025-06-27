/**
 * popup.ts
 *
 * This script is executed when the browser extension popup is opened.
 * It is responsible for handling the main UI logic of the popup window,
 * including checking whether the active tab corresponds to a Moodle course page,
 * extracting the course ID from the URL, and initiating data scraping tasks.
 *
 * Author: Raúl García Balongo
 * Date: 2025
 */

// Utility functions and constants
import { COURSE_PAGE_REGEX } from "./utils/urlBuilder";
import { getScrapeUrls } from "./utils/urlBuilder";

// Scraping services
import {
    scrapeTotalStudents,
    scrapeParticipants,
    scrapeURLResources,
    scrapeChoices,
    scrapeWorkshops, scrapeResources, scrapeForums, scrapeQuizzes
} from "./services/scraper";

/**
 * Determines if the given URL corresponds to a Moodle course main page.
 *
 * @param url - The full URL string to check.
 * @returns `true` if the URL matches the expected Moodle course view pattern, `false` otherwise.
 *
 * Example:
 *   isCoursePage("http://localhost:8080/course/view.php?id=2") => true
 */
function isCoursePage(url: string): boolean {
    return COURSE_PAGE_REGEX.test(url);
}

/**
 * Extracts the course ID from a Moodle course page URL.
 *
 * This function parses the URL and retrieves the value of the `id` parameter.
 *
 * @param url - The full URL string from which to extract the course ID.
 * @returns The course ID as a string if found, otherwise `null`.
 *
 * Example:
 *   extractCourseId("http://localhost:8080/course/view.php?id=42") => "42"
 */
function extractCourseId(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.searchParams.get("id");
    } catch (e) {
        console.error("Invalid URL:", url);
        return null;
    }
}

/**
 * Initializes the popup UI when the DOM is fully loaded.
 *
 * This script handles the main logic of the browser extension's popup interface.
 * It checks if the current tab is a Moodle course page, extracts the course ID,
 * and enables a button that triggers the scraping of course-related data such as
 * the total number of students and participant details.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Get a reference to the analysis button
    const analyzeButton = document.getElementById('analyzeButton') as HTMLButtonElement | null;

    // Get a reference to the output container
    const output = document.getElementById('output') as HTMLDivElement | null;
    const spinner = document.getElementById('spinner') as HTMLDivElement | null;

    // Ensure all required elements exist before proceeding
    if (!analyzeButton || !output || !spinner) {
        console.error('Required elements not found.');
        return;
    }

    // Query the currently active tab in the browser window
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];

        // Ensure the tab and its URL are valid
        if (!tab || !tab.url) {
            output.textContent = 'No active tab found or it has no URL.';
            analyzeButton.classList.add('hidden');
            return;
        }

        const url = tab.url;

        // Check whether the URL corresponds to a Moodle course page
        if (!isCoursePage(url)) {
            output.textContent = 'This is not a Moodle course page.';
            analyzeButton.classList.add('hidden');
            return;
        }

        // Extract the course ID from the URL's query string
        const courseId = extractCourseId(url);
        if (!courseId) {
            output.textContent = 'No course found or it has no course id.';
            analyzeButton.classList.add('hidden');
            return;
        }

        // Show confirmation message and display the analyze button
        output.textContent = `Course detected (ID: ${courseId}). Click the button to analyze.`;
        analyzeButton.classList.remove('hidden');

        // Add a click handler to trigger scraping when the button is pressed
        analyzeButton.addEventListener('click', () => {
            analyzeButton.classList.add('hidden');
            spinner.classList.remove('hidden');

            // Simulate delay (can be replaced with loading indicators or real work)
            setTimeout(() => {
                spinner.classList.add('hidden');

                // First, determine the real number of students to avoid pagination
                const preliminaryUrl = getScrapeUrls(courseId).participants;

                scrapeTotalStudents(preliminaryUrl).then(totalStudents => {
                    if (totalStudents !== null) {
                        console.log("Total students detected:", totalStudents);

                        // Generate URLs using exact student count
                        const urls = getScrapeUrls(courseId, totalStudents);

                        // Format and display the final scraping targets
                        const formatted = Object.entries(urls)
                            .map(([key, value]) => `✔ ${key}: ${value}`)
                            .join('\n');

                        output.textContent = `Scraping targets for course ID ${courseId}:\n\n${formatted}`;

                        // Scrape participants
                        scrapeParticipants(urls.participants).then(participants => {
                            console.log("Participants list:", participants);
                            console.log("Total participants scraped:", participants.length);
                        });

                        // Scrape URL resources (instead of participants)
                        scrapeURLResources(urls.activityReport).then(urlResources => {
                            console.log("URL Resources list:", urlResources);
                            console.log("Total URL resources scraped:", urlResources.length);
                        });

                        scrapeChoices(urls.activityReport).then(choices => {
                            console.log("Choices list:", choices);
                            console.log("Total choices scraped:", choices.length);
                        });

                        scrapeWorkshops(urls.activityReport).then(workshops => {
                            console.log("Workshops list:", workshops);
                            console.log("Total workshops scraped:", workshops.length);
                        });

                        scrapeResources(urls.activityReport).then(resources => {
                            console.log("Resources list:", resources);
                            console.log("Total resources scraped:", resources.length);
                        });

                        scrapeQuizzes(urls.activityReport).then(quizzes => {
                            console.log("Quizzes list:", quizzes);
                            console.log("Total quizzes scraped:", quizzes.length);
                        });

                        scrapeForums(urls.activityReport).then(forums => {
                            console.log("Forums list:", forums);
                            console.log("Total forums scraped:", forums.length);
                        });

                    } else {
                        console.warn("Unable to extract total student count.");
                    }
                });
            }, 3000); // Simulate a delay of 3 seconds

        });
    });

});
