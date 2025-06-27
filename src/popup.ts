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
import { scrapeTotalStudents, scrapeParticipants } from "./services/scraper";

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


document.addEventListener('DOMContentLoaded', () => {
    // Get a reference to the analysis button
    const analyzeButton = document.getElementById('analyzeButton') as HTMLButtonElement | null;

    // Get a reference to the output container
    const output = document.getElementById('output') as HTMLDivElement | null;
    const spinner = document.getElementById('spinner') as HTMLDivElement | null;

    if (!analyzeButton || !output || !spinner) {
        console.error('Required elements not found.');
        return;
    }

    // Obtain the current tab's URL
    // Query the currently active tab in the current window
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];

        // Validate the tab and its URL
        if (!tab || !tab.url) {
            output.textContent = 'No active tab found or it has no URL.';
            analyzeButton.classList.add('hidden');
            return;
        }

        const url = tab.url;

        // Check if the URL matches a Moodle course page
        if (!isCoursePage(url)) {
            output.textContent = 'This is not a Moodle course page.';
            analyzeButton.classList.add('hidden');
            return;
        }

        // Extract the course ID from the URL
        const courseId = extractCourseId(url);
        if (!courseId) {
            output.textContent = 'No course found or it has no course id.';
            analyzeButton.classList.add('hidden');
            return;
        }

        // Update the UI with confirmation and show the analysis button
        output.textContent = `Course detected (ID: ${courseId}). Click the button to analyze.`;
        analyzeButton.classList.remove('hidden');

        // Handle click event on the analysis button
        analyzeButton.addEventListener('click', () => {
            analyzeButton.classList.add('hidden');
            spinner.classList.remove('hidden');

            // Simulate async work (can be replaced later with actual scraping logic)
            setTimeout(() => {
                spinner.classList.add('hidden');

                // Generate initial scraping URLs (with default perPage)
                const urls = getScrapeUrls(courseId);

                // Format the URLs for display
                const formatted = Object.entries(urls)
                    .map(([key, value]) => `✔ ${key}: ${value}`)
                    .join('\n');

                output.textContent = `Scraping targets for course ID ${courseId}:\n\n${formatted}`;

                scrapeTotalStudents(urls.participants).then(totalStudents => {
                    if (totalStudents !== null) {
                        console.log("✅ Total students detected:", totalStudents);

                        const updatedUrls = getScrapeUrls(courseId, totalStudents);
                        const formattedUpdated = Object.entries(updatedUrls)
                            .map(([key, value]) => `✔ ${key}: ${value}`)
                            .join('\n');

                        output.textContent = `Updated scraping targets (real student count):\n\n${formattedUpdated}`;

                        // 🟢 Ahora scrapeamos la tabla de participantes
                        scrapeParticipants(updatedUrls.participants).then(participants => {
                            console.log("Participants list:", participants);
                            console.log("🔢 Total participants scraped:", participants.length);
                        });

                    } else {
                        console.warn("⚠Unable to extract total student count.");
                    }
                });
            }, 3000); // Simulate a delay of 3 seconds
        });
    });

});
