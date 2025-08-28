/**
 * @file App.tsx
 * @description
 * The main entry point for the Moodle Data Analyzer extension's popup interface.
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
    getScrapeUrlActivityReport,
    getScrapeUrlCourseMain,
    getScrapeUrlParticipants,
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
import ExportAllSelector from "./components/ExportAllSelector";
import {ExportProvider} from "./context/ExportContext";
import {devlog} from "./utils/devlog";

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

    // Indicates if data has been restored from storage
    const setIsRestored = useState(false)[1];

    const [courseName, setCourseName] = useState<string | null>(null);
    const [isRestoredDataAvailable, setIsRestoredDataAvailable] = useState(false);

    // HOOK
    const relativeTime = useRelativeTime(lastAnalyzedAt);

    async function fetchTotalParticipants(courseId: string): Promise<number | null> {
        const {participants: preliminaryUrl} = getScrapeUrlParticipants(courseId);
        devlog.info("app", "fetchTotalParticipants:start", {courseId, preliminaryUrl});

        const t0 = performance.now();
        const total = await scrapeNumParticipants(preliminaryUrl); // Fetch the total participant count
        const ms = Math.round(performance.now() - t0);

        if (total === null) {
            devlog.error("app", "fetchTotalParticipants:total is null (unable to extract)", {courseId, ms});
        } else {
            devlog.info("app", "fetchTotalParticipants:ok", {courseId, total, ms});
        }

        return total;
    }

    async function fetchAndStoreCourseData(courseId: string, totalParticipants: number) {
        const {courseMain} = getScrapeUrlCourseMain(courseId);           // URL to get the course name
        const {activityReport} = getScrapeUrlActivityReport(courseId);   // URL to get an activity report
        const {participants} = getScrapeUrlParticipants(courseId, totalParticipants); // Paginated URL for all participants

        devlog.info("app", "fetchAndStoreCourseData:urls prepared", {
            courseId, totalParticipants, courseMain, activityReport, participants
        });

        // Main scraping function
        const t0 = performance.now();
        const course = await scrapeCourse(courseId, courseMain, activityReport, participants, totalParticipants);
        Math.round(performance.now() - t0);
        const storageData = {
            [`course_${courseId}`]: course,
            lastAnalyzedCourseId: courseId,
            lastAnalyzedAt: Date.now(),
        };

        // Save course data and analysis metadata to local storage
        chrome.storage.local.set(storageData, () => {
            const err = chrome.runtime.lastError;
            if (err) {
                devlog.error("app", "fetchAndStoreCourseData:storage error", {message: err.message});
            } else {
                devlog.info("app", "fetchAndStoreCourseData:storage ok", {key: `course_${courseId}`});
            }
        });

        return course;
    }

    async function analyzeCourseData(courseId: string) {
        const t0 = performance.now();
        devlog.info("app", "analyze:start", {courseId});

        setIsLoading(true);           // Show loading state
        setButton(null);              // Remove the existing button while analyzing
        setIsRestored(false);         // Clear restored flag
        setOutputMessage("");         // Reset message
        devlog.info("app", "analyze:UI reset done");

        try {
            // Get the total number of participants
            devlog.info("app", "analyze:fetchTotalParticipants");
            const totalParticipants = await fetchTotalParticipants(courseId);
            devlog.info("app", "analyze:totalParticipants", {totalParticipants});

            if (totalParticipants === null) {
                devlog.error("app", "analyze:participants null → show restart button");
                setOutputMessage("Failed to determine participant count."); // Error if count not retrieved
                setButton(<RestartButton courseId={courseId} onClick={analyzeCourseData}/>);
                return;
            }

            devlog.info("app", "analyze:scrape & store course data");
            const course = await fetchAndStoreCourseData(courseId, totalParticipants);

            setCourseName(course.courseName ?? null);

            setIsError(false);
            setOutputMessage("success_analysis_completed");
            setButton(<RestartButton courseId={courseId} onClick={analyzeCourseData}/>);
            const now = new Date();
            setLastAnalyzedAt(now);

            devlog.info("app", "analyze:success", {
                courseId,
                analyzedAt: now.toISOString(),
                durationMs: Math.round(performance.now() - t0),
            });
        } catch (error) {
            devlog.error("app", "analyze:error", {error: String(error)});
            setOutputMessage("An error occurred while analyzing the course."); // Catch unexpected errors
        } finally {
            setIsLoading(false); // End loading state
        }
    }

    async function analyzeCourseDataWithCleanup(courseId: string) {
        devlog.info("app", "cleanup:check", {targetCourseId: courseId});

        chrome.storage.local.get("lastAnalyzedCourseId", (res) => {
            const lastId = res.lastAnalyzedCourseId;
            devlog.info("app", "cleanup:lastAnalyzedCourseId", {lastId});

            if (lastId && lastId !== courseId) {
                devlog.info("app", "cleanup:removing previous course data", {lastId});

                chrome.storage.local.remove(
                    [`course_${lastId}`, "lastAnalyzedCourseId", "lastAnalyzedAt"],
                    () => {
                        const err = chrome.runtime.lastError;
                        if (err) {
                            devlog.error("app", "cleanup:remove error", {error: err.message});
                        } else {
                            devlog.info("app", "cleanup:removed ok", {lastId});
                        }
                        analyzeCourseData(courseId);
                    }
                );
            } else {
                analyzeCourseData(courseId);
            }
        });
    }

    function validateAndExtractCourseId(url?: string): string | null {

        if (!url || !url.startsWith("http")) {
            devlog.warn("app", "invalid_url", {url});
            setTranslatedError("error_invalid_url");
            return null;
        }

        const {isCoursePage, courseId} = extractMoodleCourseId(url);
        devlog.info("app", "extractMoodleCourseId result", {isCoursePage, courseId});

        if (!isCoursePage) {
            devlog.warn("app", "not_course_page", {url});
            setTranslatedError("error_not_course_page");
            return null;
        }

        if (!courseId) {
            devlog.warn("app", "missing_course_id", {url});
            setTranslatedError("error_missing_course_id");
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
            devlog.warn("app", "invalid course page → reset state");
            setIsValidCoursePage(false);
            setCurrentCourseId(null);
            setIsRestored(false);
        }
    }

    const setTranslatedError = (key: string) => {
        setOutputMessage(key);
        setIsError(true);
    };

    // On mount: check the current active tab to extract the course ID
    useEffect(() => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const url = tabs?.[0]?.url;
            devlog.info("app", "active tab url", url);
            extractAndSetCourseId(url);
        });
    }, []);

    // When a tab is updated or activated, re-extract the course ID (for side panel support)
    useEffect(() => {

        const handleTabUpdate = (
            _tabId: number,
            changeInfo: chrome.tabs.TabChangeInfo,
            tab: chrome.tabs.Tab
        ) => {
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
                    setButton(<StartButton courseId={currentCourseId} onClick={analyzeCourseDataWithCleanup}/>);
                    return;
                }

                if (!course) {
                    // No data available for the current course
                    devlog.warn("app", "restore: no course data", {
                        currentCourseId,
                        lastId,
                    });
                    if (!lastId) {
                        setButton(<StartButton courseId={currentCourseId} onClick={analyzeCourseData}/>);
                    }
                    return;
                }

                // Restore existing course data
                devlog.info("app", "restore: apply course data", {
                    course
                });

                setCourseName(course.courseName ?? null);
                setButton(<RestartButton courseId={currentCourseId} onClick={analyzeCourseData}/>);
                setIsRestored(true);
                setIsRestoredDataAvailable(true);
                setIsError(false);

                if (timestamp) {
                    const date = new Date(timestamp);
                    setLastAnalyzedAt(date);
                }
            }
        );
    }, [isValidCoursePage, currentCourseId]);

    return (
        <ExportProvider>
            <AnalysisContext.Provider value={{lastAnalyzedAt}}>
                <div
                    className={`relative bg-white rounded-xl shadow-xl p-4 px-4 sm:px-6 w-full
                     mx-auto
            ${(outputMessage || isRestoredDataAvailable) && !isError ? "min-w-[310px] max-w-[749px]"
                        : "min-w-[310px] max-w-[600px]"}`}
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
                            {outputMessage && (
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
                                            className="mt-4 border border-orange-300 rounded-md px-3 py-2 text-center
                                            text-sm text-gray-800 font-semibold animate-fade-in"
                                        >
                                            <Trans
                                                i18nKey="course_name_display"
                                                values={{name: courseName}}
                                                components={{
                                                    orange: <span className="text-orange-600 font-bold"/>,
                                                }}
                                            />
                                        </div>
                                    )}

                                    <div className="mt-4 flex justify-center animate-fade-in">
                                        <ExportAllSelector/>
                                    </div>

                                </>
                            )}

                            {(outputMessage || isRestoredDataAvailable) && !isError && <TabSection/>}
                        </>
                    )}
                </div>
            </AnalysisContext.Provider>
        </ExportProvider>
    );
}