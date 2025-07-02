/**
 * @file popup.ts
 * @description Script executed when the browser extension popup is opened.
 * Handles the UI logic for the popup window, including
 * - Verifying if the active tab is a Moodle course page.
 * - Extracting the course ID from the URL.
 * - Triggering the corresponding scraping routines.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

// Utility functions and constants
import {
    COURSE_PAGE_REGEX,
    getScrapeUrls
} from "./utils/urlBuilder";

// Scraping services
import {
    scrapeNumParticipants,
    scrapeCourse
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
 * the total number of participants and participant details.
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

        // Show a confirmation message and display the analysis button
        analyzeButton.classList.remove('hidden');

        // Add a click handler to trigger scraping when the button is pressed
        analyzeButton.addEventListener('click', () => {
            analyzeButton.classList.add('hidden'); // Hide the button during processing
            spinner.classList.remove('hidden');    // Show the loading spinner

            const preliminaryUrl = getScrapeUrls(courseId).participants;

            // First, get the total number of participants
            scrapeNumParticipants(preliminaryUrl).then(totalParticipants => {
                if (totalParticipants !== null) {
                    const urls = getScrapeUrls(courseId, totalParticipants);

                    // Scrape the full course data using all the correct URLs
                    scrapeCourse(courseId, urls.activityReport, urls.participants, totalParticipants).then(course => {
                        console.log("Course data:", course);
                        output.textContent = 'Analysis complete. Check the logs for detailed data.';
                        spinner.classList.add('hidden'); // Hide the spinner after scraping is done
                    });

                } else {
                    console.warn("Unable to extract total student count.");
                    output.textContent = 'Failed to determine participant count.';
                    spinner.classList.add('hidden'); // Also hide spinner if scraping fails
                }
            });
        });
    });
});
