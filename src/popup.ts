//import './tailwind.css';
// popup.ts
// This script runs when the popup is opened and handles UI interactions.

import {COURSE_PAGE_REGEX} from "./config/constants";

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
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url) {
            output.textContent = 'No active tab found or it has no URL.';
            analyzeButton.classList.add('hidden'); // Hide the button
            return;
        }

        const url = tab.url;

        if (!isCoursePage(url)) {
            output.textContent = 'This is not a Moodle course page.';
            analyzeButton.classList.add('hidden'); // Hide the button
            return;
        }

        const courseId = extractCourseId(url);
        if (!courseId) {
            output.textContent = 'No course found or it has no course id.';
            analyzeButton.classList.add('hidden'); // Hide the button
            return;
        }

        // If we reach here, the URL is valid and we have a course ID
        output.textContent = `Course detected (ID: ${courseId}). Click the button to analyze.`;
        analyzeButton.classList.remove('hidden'); // Show the button

        // Add a click event listener to the button
        analyzeButton.addEventListener('click', () => {
            analyzeButton.classList.add('hidden'); // Hide the button
            spinner.classList.remove('hidden'); // Show the spinner

            // Simulate async work (e.g., fetching data, scraping)
            setTimeout(() => {
                spinner.classList.add('hidden'); // Hide the spinner

                // Show result (replace with graph rendering later)
                output.textContent = 'Graphs are ready (This is just a placeholder).';
            }, 3000); // Simulate 3 seconds of work
        })
    });
});
