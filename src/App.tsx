/**
 * @file App.tsx
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

    const [isValidCoursePage, setIsValidCoursePage] = useState(false);
    const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [outputMessage, setOutputMessage] = useState("");
    const [button, setButton] = useState<ReactElement | null>(null);
    const [lastAnalyzedAgo, setLastAnalyzedAgo] = useState<string | null>(null);
    const [isRestored, setIsRestored] = useState(false);

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
        const {participants: preliminaryUrl} = getScrapeUrlParticipants(courseId);
        const total = await scrapeNumParticipants(preliminaryUrl);

        if (total === null) {
            console.warn("Unable to extract total participant count.");
        }

        return total;
    }

    async function fetchAndStoreCourseData(courseId: string, totalParticipants: number) {
        const {participants} = getScrapeUrlParticipants(courseId, totalParticipants);
        const {activityReport} = getScrapeUrlActivityReport(courseId);

        const course = await scrapeCourse(courseId, activityReport, participants, totalParticipants);
        console.log("Course data:", course);

        const storageData = {
            [`course_${courseId}`]: course,
            lastAnalyzedCourseId: courseId,
            lastAnalyzedAt: Date.now(),
        };

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

        setIsLoading(true);
        setButton(null);
        setIsRestored(false);
        setOutputMessage("");

        try {
            const totalParticipants = await fetchTotalParticipants(courseId);

            if (totalParticipants === null) {
                setOutputMessage("Failed to determine participant count.");
                setButton(createRestartButton(courseId, analyzeCourseData));
                return;
            }

            await fetchAndStoreCourseData(courseId, totalParticipants);

            setIsError(false);

            setOutputMessage("Analysis completed successfully!");
            setButton(createRestartButton(courseId, analyzeCourseData));
            setLastAnalyzedAgo(getRelativeTime(new Date()));
        } catch (error) {
            console.error("Error during analysis:", error);
            setOutputMessage("An error occurred while analyzing the course.");
        } finally {
            setIsLoading(false);
        }
    }

    function validateAndExtractCourseId(url?: string): string | null {
        if (!url || !url.startsWith("http")) {
            displayErrorMessage("No active tab found or the URL is not valid.");
            return null;
        }

        const {isCoursePage, courseId} = extractMoodleCourseId(url);

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
        setIsError(true);
    };

    useEffect(() => {
        const initializePopup = () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                const tab = tabs?.[0];
                const courseId = validateAndExtractCourseId(tab?.url);
                if (!courseId) return;

                setIsValidCoursePage(true);
                setCurrentCourseId(courseId);

                maybeRenderStartButton(courseId);
            });
        };

        const maybeRenderStartButton = (courseId: string) => {
            chrome.storage.local.get("lastAnalyzedCourseId", (res) => {
                if (!res.lastAnalyzedCourseId) {
                    setButton(createStartButton(courseId, analyzeCourseData));
                }
            });
        };

        initializePopup();
    }, []);

    useEffect(() => {
        if (!isValidCoursePage || !currentCourseId) return;

        const restorePreviousAnalysis = () => {
            chrome.storage.local.get([`course_${currentCourseId}`, "lastAnalyzedAt"], (data) => {
                const course = data[`course_${currentCourseId}`];
                const timestamp = data.lastAnalyzedAt;

                if (!course) return;

                console.log("Restoring previous course data:", course);

                setButton(createRestartButton(currentCourseId, analyzeCourseData));
                setIsRestored(true);
                setOutputMessage("Previous analysis restored.");
                setIsError(false);

                if (timestamp) {
                    setLastAnalyzedAgo(getRelativeTime(new Date(timestamp)));
                }
            });
        };

        restorePreviousAnalysis();
    }, [isValidCoursePage, currentCourseId]);

    useEffect(() => {
        if (!isValidCoursePage || !currentCourseId) return;

        const updateLastAnalyzedAgo = () => {
            chrome.storage.local.get("lastAnalyzedAt", (data) => {
                const timestamp = data.lastAnalyzedAt;
                if (timestamp) {
                    setLastAnalyzedAgo(getRelativeTime(new Date(timestamp)));
                }
            });
        };

        updateLastAnalyzedAgo();

        const interval = setInterval(updateLastAnalyzedAgo, 60_000);

        return () => clearInterval(interval);
    }, [isValidCoursePage, currentCourseId]);

    return (
        <div className="bg-white rounded-xl shadow-xl p-4 text-center w-fit h-fit">
            <div className="flex flex-row items-center justify-center gap-2 mb-4 animate-fade-in">
                <img
                    src="/icons/icon48.png"
                    alt="Extension Logo"
                    className="w-6 h-6 drop-shadow-sm"
                />
                <h1 className="text-2xl font-black text-orange-600 tracking-wide drop-shadow-sm border-b-2 border-orange-200 pb-1">
                    Moodle Data Analyzer
                </h1>
            </div>

            {isLoading && <Loader/>}

            {!isLoading && (
                <>
                    {button}

                    {!isRestored && outputMessage && (
                        <InfoCard message={outputMessage} isError={isError}/>
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

                    {outputMessage && !isError && <TabSection/>}
                </>
            )}
        </div>
    );
}