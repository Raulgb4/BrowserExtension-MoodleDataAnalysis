//import './tailwind.css';
// popup.ts
// This script runs when the popup is opened and handles UI interactions.

import {COURSE_PAGE_REGEX} from "./config/constants";
import {getScrapeUrls} from "./utils/urlBuilder";

function isCoursePage(url: string): boolean {
    return COURSE_PAGE_REGEX.test(url);
}

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

                // Fetch the HTML content of the participants page
                fetch(urls.participants)
                    .then(response => response.text())
                    .then(html => {
                        // Parse the HTML response
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');

                        // Locate the dynamic table element with student count
                        const dynamicTable = doc.querySelector('[data-region="core_table/dynamic"]');

                        if (dynamicTable) {
                            const totalRows = dynamicTable.getAttribute("data-table-total-rows");
                            const totalStudents = totalRows ? parseInt(totalRows, 10) : null;

                            if (totalStudents !== null) {
                                console.log("Total students detected:", totalStudents);

                                // Generate new URLs using the actual student count
                                const updateUrls = getScrapeUrls(courseId, totalStudents);

                                const formattedUpdated = Object.entries(updateUrls)
                                    .map(([key, value]) => `✔ ${key}: ${value}`)
                                    .join('\n');

                                // Update the UI with the new URLs
                                output.textContent = `Updated scraping targets (real student count):\n\n${formattedUpdated}`;
                            } else {
                                console.warn("data-table-total-rows attribute not found or invalid.");
                            }
                        } else {
                            console.warn("Dynamic table not found in the participants page.");
                        }
                    })
                    .catch(error => {
                        console.error("Error fetching participants page:", error);
                    });

            }, 3000); // Simulate a delay of 3 seconds
        });
    });

});
