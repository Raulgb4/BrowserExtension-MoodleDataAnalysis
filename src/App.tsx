/**
 * @file App.tsx
 * @description
 * Main entry point for the Moodle Data Analyzer extension's popup interface.
 * This component coordinates the initialization, data scraping, UI rendering,
 * and state management of the extension. It handles:
 *
 * - Verifying whether the current tab is a Moodle course page.
 * - Extracting the course ID from the URL.
 * - Providing a button to start or reanalyze the course data.
 * - Launching scraping routines to collect participant and activity information.
 * - Persisting scraped data into `chrome.storage.local`.
 * - Displaying feedback messages and restoring previous analysis sessions.
 * - Updating the UI with the last analysis timestamp and access to detailed views.
 *
 * Integrates with context providers and child components like Button, Loader, InfoCard, and TabSection.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, {ReactElement, useEffect, useState} from "react";
import {
    extractMoodleCourseId,
    getScrapeUrlParticipants,
    getScrapeUrlActivityReport,
} from "./utils/urlBuilder";
import {scrapeCourse, scrapeNumParticipants} from "./services/dataExtractor";
import Button from "./components/Button";
import Loader from "./components/Loader";
import InfoCard from "./components/InfoCard";
import TabSection from "./components/TabSection";
import {getRelativeTime} from "./services/dataProcessor";
import {ClockIcon} from "@heroicons/react/20/solid";
import {AnalysisContext} from "./context/AnalysisContext";

/**
 * @function App
 * @description
 * The main React part responsible for rendering the user interface of the Moodle Data Analyzer extension.
 * This component handles initialization, user interaction, data scraping, and UI updates.
 *
 * On mount, it checks whether the current browser tab is a Moodle course page.
 * If valid, it extracts the course ID and enables the user to start the analysis process via a button.
 * Once the analysis is triggered, it scrapes relevant course data and updates the UI accordingly.
 *
 * @returns JSX.Element The rendered user interface, including a title, a loading spinner,
 * a start/restart button, and an info card displaying feedback messages or errors.
 */
export function App() {

    // Checks if the current page is a valid Moodle course page
    const [isValidCoursePage, setIsValidCoursePage] = useState(false);
    // Stores the detected course ID
    const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false); // Indicates data scraping in progress
    const [isError, setIsError] = useState(false); // Tracks if an error occurred during scraping
    const [outputMessage, setOutputMessage] = useState(""); // Message shown to the user after scraping
    const [button, setButton] = useState<ReactElement | null>(null); // Start or restart a button element
    const [lastAnalyzedAgo, setLastAnalyzedAgo] = useState<string | null>(null); // Time since last analysis
    // Absolute timestamp of the last analysis (used for file naming and detailed logs)
    const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
    const [isRestored, setIsRestored] = useState(false); // Indicates if data has been restored from storage

    function createStartButton(courseId: string, onClick: (id: string) => void): ReactElement {
        return (
            <Button
                id="startButton"
                text="Start"
                onClick={() => onClick(courseId)}
            />
        );
    }

    function createRestartButton(courseId: string, onClick: (id: string) => void): ReactElement {
        return (
            <Button
                id="restartButton"
                text="Reanalyze"
                onClick={() => onClick(courseId)}
            />
        );
    }

    async function fetchTotalParticipants(courseId: string): Promise<number | null> {
        const {participants: preliminaryUrl} = getScrapeUrlParticipants(courseId); // Get initial participant URL (no limit)
        const total = await scrapeNumParticipants(preliminaryUrl); // Fetch the total participant count

        if (total === null) {
            console.warn("Unable to extract total participant count.");
        }

        return total;
    }

    async function fetchAndStoreCourseData(courseId: string, totalParticipants: number) {
        const {participants} = getScrapeUrlParticipants(courseId, totalParticipants); // Paginated URL for all participants
        const {activityReport} = getScrapeUrlActivityReport(courseId); // URL to get an activity report

        // Main scraping function
        const course = await scrapeCourse(courseId, activityReport, participants, totalParticipants);
        console.log("Course data:", course);

        const storageData = {
            [`course_${courseId}`]: course,
            lastAnalyzedCourseId: courseId,
            lastAnalyzedAt: Date.now(),
        };

        // Save course data and analysis metadata to local storage
        chrome.storage.local.set(storageData, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving course data:", chrome.runtime.lastError);
            } else {
                console.log(`Course data saved successfully under key "course_${courseId}"`);
            }
        });

        return course;
    }

    async function analyzeCourseData(courseId: string) {
        setIsLoading(true); // Show loading state
        setButton(null); // Remove the existing button while analyzing
        setIsRestored(false); // Clear restored flag
        setOutputMessage(""); // Reset message

        try {
            // Get the total number of participants
            const totalParticipants = await fetchTotalParticipants(courseId);

            if (totalParticipants === null) {
                setOutputMessage("Failed to determine participant count."); // Error if count not retrieved
                setButton(createRestartButton(courseId, analyzeCourseData)); // Offer retry
                return;
            }

            await fetchAndStoreCourseData(courseId, totalParticipants); // Scrape and store course data

            setIsError(false);
            setOutputMessage("Analysis completed successfully!");
            setButton(createRestartButton(courseId, analyzeCourseData)); // Offer to reanalyze
            const now = new Date();
            setLastAnalyzedAgo(getRelativeTime(now));
            setLastAnalyzedAt(now);
        } catch (error) {
            console.error("Error during analysis:", error);
            setOutputMessage("An error occurred while analyzing the course."); // Catch unexpected errors
        } finally {
            setIsLoading(false); // End loading state
        }
    }

    function validateAndExtractCourseId(url?: string): string | null {
        if (!url || !url.startsWith("http")) {
            displayErrorMessage("No active tab found or the URL is not valid.");
            return null;
        }

        const {isCoursePage, courseId} = extractMoodleCourseId(url); // Try to extract course ID from URL

        if (!isCoursePage) {
            displayErrorMessage("This page is not recognized as part of a Moodle course.");
            return null;
        }

        if (!courseId) {
            displayErrorMessage("Unable to detect a course ID in the current Moodle URL.");
            return null;
        }

        return courseId;
    }

    const displayErrorMessage = (message: string) => {
        setOutputMessage(message);
        setIsError(true); // Show error indicator in UI
    };

    useEffect(() => {
        const initializePopup = () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                const tab = tabs?.[0];
                const courseId = validateAndExtractCourseId(tab?.url); // Validate and extract course ID
                if (!courseId) return;

                setIsValidCoursePage(true); // Confirm we are on a valid Moodle course page
                setCurrentCourseId(courseId); // Store course ID

                maybeRenderStartButton(courseId); // Show the start button if needed
            });
        };

        const maybeRenderStartButton = (courseId: string) => {
            chrome.storage.local.get("lastAnalyzedCourseId", (res) => {
                if (!res.lastAnalyzedCourseId) {
                    setButton(createStartButton(courseId, analyzeCourseData)); // Only show if no previous analysis
                }
            });
        };

        initializePopup(); // Run on mount
    }, []);

    useEffect(() => {
        if (!isValidCoursePage || !currentCourseId) return;

        const restorePreviousAnalysis = () => {
            chrome.storage.local.get(["lastAnalyzedCourseId", `course_${currentCourseId}`, "lastAnalyzedAt"], (data) => {
                const lastAnalyzedId = data.lastAnalyzedCourseId;
                const course = data[`course_${currentCourseId}`];
                const timestamp = data.lastAnalyzedAt;

                // Show error if the current course is different from the last analyzed
                if (lastAnalyzedId && lastAnalyzedId !== currentCourseId) {
                    setIsError(true);
                    setOutputMessage("La extensión no soporta varios cursos.");
                    setIsRestored(false);
                    setButton(null);
                    return;
                }

                // Normal restore
                if (!course) return;

                console.log("Restoring previous course data:", course);

                setButton(createRestartButton(currentCourseId, analyzeCourseData));
                setIsRestored(true);
                setOutputMessage("Previous analysis restored.");
                setIsError(false);

                if (timestamp) {
                    const date = new Date(timestamp);
                    setLastAnalyzedAgo(getRelativeTime(date));
                    setLastAnalyzedAt(date);
                }
            });
        };

        restorePreviousAnalysis();
    }, [isValidCoursePage, currentCourseId]);

    useEffect(() => {
        setIsRestored(false);
        setOutputMessage("");
        setIsError(false);
        setButton(null);
        setLastAnalyzedAgo(null);
        setLastAnalyzedAt(null);
    }, [currentCourseId]);

    useEffect(() => {
        if (!isValidCoursePage || !currentCourseId) return;

        const updateLastAnalyzedAgo = () => {
            chrome.storage.local.get("lastAnalyzedAt", (data) => {
                const timestamp = data.lastAnalyzedAt;
                if (timestamp) {
                    setLastAnalyzedAgo(getRelativeTime(new Date(timestamp))); // Update relative time display
                }
            });
        };

        updateLastAnalyzedAgo(); // Initial call

        const interval = setInterval(updateLastAnalyzedAgo, 60_000); // Refresh every 60s

        return () => clearInterval(interval); // Cleanup on unmounting
    }, [isValidCoursePage, currentCourseId]);

    return (
        <AnalysisContext.Provider value={{lastAnalyzedAgo, lastAnalyzedAt}}>
            <div className="bg-white rounded-xl shadow-xl p-4 text-center w-fit h-fit">
                <div className="flex flex-row items-center justify-center gap-2 mb-4 animate-fade-in">
                    <img
                        src="/icons/icon48.png"
                        alt="Extension Logo"
                        className="w-6 h-6 drop-shadow-sm"
                    />
                    <h1 className="text-2xl font-black text-orange-600 tracking-wide drop-shadow-sm border-b-2
                    border-orange-200 pb-1 whitespace-nowrap">
                        Moodle Data Analyzer
                    </h1>
                </div>

                {isLoading && <Loader/>} {/* Show loader while analyzing */}

                {!isLoading && (
                    <>
                        {button} {/* Start or reanalyze button */}

                        {!isRestored && outputMessage && (
                            <InfoCard message={outputMessage} isError={isError}/> // Show a feedback message
                        )}

                        {lastAnalyzedAgo && !isError && (
                            <div className="mt-4 mx-auto flex items-center gap-2 text-sm text-gray-700
                        bg-orange-50 border border-orange-200 px-3 py-1.5 rounded shadow-sm
                        animate-fade-in w-fit">
                                <ClockIcon className="w-4 h-4 text-orange-500"/>
                                <span>
                                Last analysis performed{" "}
                                    <span className="font-medium text-orange-600">{lastAnalyzedAgo}</span> ago
                            </span>
                            </div>
                        )}

                        {outputMessage && !isError && <TabSection/>} {/* Load tab interface after success */}
                    </>
                )}
            </div>
        </AnalysisContext.Provider>
    );
}