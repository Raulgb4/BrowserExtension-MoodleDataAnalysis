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
    getScrapeUrlActivityReport, getScrapeUrlCourseMain,
} from "./utils/urlBuilder";
import {scrapeCourse, scrapeNumParticipants} from "./services/dataExtractor";
import Loader from "./components/Loader";
import InfoCard from "./components/InfoCard";
import TabSection from "./components/TabSection";
import {ClockIcon} from "@heroicons/react/20/solid";
import {AnalysisContext} from "./context/AnalysisContext";
import LanguageSelector from "./components/LanguageSelector";
import StartButton from "./components/StartButton";
import RestartButton from "./components/RestartButton";
import {Trans, useTranslation} from "react-i18next";
import {useRelativeTime} from "./hooks/useRelativeTime";

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

    const {t} = useTranslation();

    // Checks if the current page is a valid Moodle course page
    const [isValidCoursePage, setIsValidCoursePage] = useState(false);
    // Stores the detected course ID
    const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false); // Indicates data scraping in progress
    const [isError, setIsError] = useState(false); // Tracks if an error occurred during scraping
    const [outputMessage, setOutputMessage] = useState(""); // Message shown to the user after scraping
    const [button, setButton] = useState<ReactElement | null>(null); // Start or restart a button element

    const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
    const [isRestored, setIsRestored] = useState(false); // Indicates if data has been restored from storage

    const [courseName, setCourseName] = useState<string | null>(null);

    // HOOK
    const relativeTime = useRelativeTime(lastAnalyzedAt);

    async function fetchTotalParticipants(courseId: string): Promise<number | null> {
        const {participants: preliminaryUrl} = getScrapeUrlParticipants(courseId); // Get initial participant URL (no limit)
        const total = await scrapeNumParticipants(preliminaryUrl); // Fetch the total participant count

        if (total === null) {
            console.warn("Unable to extract total participant count.");
        }

        return total;
    }

    async function fetchAndStoreCourseData(courseId: string, totalParticipants: number) {
        const {courseMain} = getScrapeUrlCourseMain(courseId); // URL to get the course name
        const {activityReport} = getScrapeUrlActivityReport(courseId); // URL to get an activity report
        const {participants} = getScrapeUrlParticipants(courseId, totalParticipants); // Paginated URL for all participants

        // Main scraping function
        const course = await scrapeCourse(courseId, courseMain, activityReport, participants, totalParticipants);
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
                setButton(<RestartButton courseId={courseId} onClick={analyzeCourseData}/>);
                return;
            }

            const course = await fetchAndStoreCourseData(courseId, totalParticipants);
            setCourseName(course.courseName ?? null);

            setIsError(false);
            setOutputMessage("success_analysis_completed");
            setButton(<RestartButton courseId={courseId} onClick={analyzeCourseData}/>);
            const now = new Date();

            setLastAnalyzedAt(now);
        } catch (error) {
            console.error("Error during analysis:", error);
            setOutputMessage("An error occurred while analyzing the course."); // Catch unexpected errors
        } finally {
            setIsLoading(false); // End loading state
        }
    }

    async function analyzeCourseDataWithCleanup(courseId: string) {
        chrome.storage.local.get("lastAnalyzedCourseId", (res) => {
            const lastId = res.lastAnalyzedCourseId;
            if (lastId && lastId !== courseId) {
                chrome.storage.local.remove(
                    [`course_${lastId}`, "lastAnalyzedCourseId", "lastAnalyzedAt"],
                    () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error removing old course data:", chrome.runtime.lastError);
                        } else {
                            console.log(`Previous course data (${lastId}) removed.`);
                            analyzeCourseData(courseId);
                        }
                    }
                );
            } else {
                analyzeCourseData(courseId);
            }
        });
    }

    function validateAndExtractCourseId(url?: string): string | null {
        if (!url || !url.startsWith("http")) {
            setTranslatedError('error_invalid_url');
            return null;
        }

        const {isCoursePage, courseId} = extractMoodleCourseId(url);

        if (!isCoursePage) {
            setTranslatedError('error_not_course_page');
            return null;
        }

        if (!courseId) {
            setTranslatedError('error_missing_course_id');
            return null;
        }

        return courseId;
    }

    function extractAndSetCourseId(url?: string | null) {
        const courseId = validateAndExtractCourseId(url ?? undefined);

        if (courseId) {
            setIsValidCoursePage(true);
            setCurrentCourseId(courseId);
        } else {
            setIsValidCoursePage(false);
            setCurrentCourseId(null);

            if (currentCourseId !== null) {
                setTranslatedError('error_not_course_page');
            }
        }
    }

    const setTranslatedError = (key: string) => {
        setOutputMessage(key);
        setIsError(true);
    };


    // On mount: check the current active tab to extract the course ID
    useEffect(() => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            extractAndSetCourseId(tabs?.[0]?.url);
        });
    }, []);

    // When a tab is updated or activated, re-extract the course ID (for side panel support)
    useEffect(() => {
        const handleTabUpdate = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            if (changeInfo.status === "complete" && tab.active) {
                extractAndSetCourseId(tab.url);
            }
        };

        const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
            chrome.tabs.get(activeInfo.tabId, (tab) => {
                extractAndSetCourseId(tab?.url);
            });
        };

        chrome.tabs.onUpdated.addListener(handleTabUpdate);
        chrome.tabs.onActivated.addListener(handleTabActivated);

        return () => {
            chrome.tabs.onUpdated.removeListener(handleTabUpdate);
            chrome.tabs.onActivated.removeListener(handleTabActivated);
        };
    }, []);

    // Clear analysis UI state when switching course
    useEffect(() => {
        if (!currentCourseId) return; // Don’t reset if switching to an invalid tab

        setIsRestored(false);
        setOutputMessage("");
        setIsError(false);
        setButton(null);
        setLastAnalyzedAt(null);
    }, [currentCourseId]);

    // Restore previous analysis for the current course, if available
    useEffect(() => {
        if (!isValidCoursePage || !currentCourseId) return;

        chrome.storage.local.get(
            ["lastAnalyzedCourseId", `course_${currentCourseId}`, "lastAnalyzedAt"],
            (data) => {
                const lastId = data.lastAnalyzedCourseId;
                const course = data[`course_${currentCourseId}`];
                const timestamp = data.lastAnalyzedAt;

                if (lastId && lastId !== currentCourseId) {
                    // Don't restore if a user switched courses
                    setButton(<StartButton courseId={currentCourseId} onClick={analyzeCourseData}/>);
                    return;
                }

                if (!course) {
                    // No data available for the current course
                    if (!lastId) {
                        setButton(<StartButton courseId={currentCourseId} onClick={analyzeCourseDataWithCleanup}/>);
                    }
                    return;
                }

                // Restore existing course data
                console.log("Restoring previous course data:", course);
                //console.log("Course name:", course.courseName);
                setCourseName(course.courseName ?? null);
                setButton(<RestartButton courseId={currentCourseId} onClick={analyzeCourseData}/>);
                setIsRestored(true);
                setOutputMessage("Previous analysis restored.");
                setIsError(false);

                if (timestamp) {
                    const date = new Date(timestamp);
                    setLastAnalyzedAt(date);
                }
            }
        );
    }, [isValidCoursePage, currentCourseId]);

    return (
        <AnalysisContext.Provider value={{lastAnalyzedAt}}>
            <div
                className={`relative bg-white rounded-xl shadow-xl p-4 px-4 sm:px-6 w-full mx-auto
            ${outputMessage && !isError ? "min-w-[310px] max-w-[700px]" : "min-w-[310px] max-w-[600px]"}`}
            >
                <div className="absolute top-3 right-3">
                    <LanguageSelector/>
                </div>

                <div className="flex flex-col items-center justify-center gap-2 mb-4 animate-fade-in text-center">
                    <img
                        src="/icons/icon48.png"
                        alt="Extension Logo"
                        className="w-6 h-6 drop-shadow-sm"
                    />
                    <h1
                        className="text-2xl xs:text-xl font-black text-orange-600 tracking-wide drop-shadow-sm
                    border-b-2 border-orange-200 pb-1 whitespace-nowrap"
                    >
                        Moodle Data Analyzer
                    </h1>

                    {!isLoading && !isError && (
                        <>
                            <div className="mt-4">{button}</div>
                        </>
                    )}
                </div>

                {isLoading && <Loader/>}

                {!isLoading && (
                    <>
                        {!isRestored && outputMessage && (
                            <InfoCard message={t(outputMessage)} isError={isError}/>
                        )}

                        {lastAnalyzedAt && !isError && (
                            <>
                                <div className="mt-4 flex justify-center">
                                    <div
                                        className="inline-flex flex-wrap justify-center items-center gap-2 text-sm
                                    text-gray-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded
                                    shadow-sm animate-fade-in"
                                    >
                                        <ClockIcon className="w-4 h-4 text-orange-500"/>
                                        <span className="text-center">
                                        <Trans
                                            i18nKey="last_analysis"
                                            values={{time: relativeTime}}
                                            components={{
                                                orange: <span className="font-medium text-orange-600"/>,
                                            }}
                                        />
                                    </span>
                                    </div>
                                </div>

                                {courseName && (
                                    <div
                                        className="mt-4 border border-orange-300 rounded-md px-3 py-2 text-center text-sm text-gray-800 font-semibold animate-fade-in"
                                    >
                                        <Trans
                                            i18nKey="course_name_display"
                                            values={{ name: courseName }}
                                            components={{
                                                orange: <span className="text-orange-600 font-bold" />,
                                            }}
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {outputMessage && !isError && <TabSection/>}
                    </>
                )}
            </div>
        </AnalysisContext.Provider>
    );
}