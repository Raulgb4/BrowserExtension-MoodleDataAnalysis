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
    const [isLoading, setIsLoading] = useState(false);
    const [outputMessage, setOutputMessage] = useState("");
    const [button, setButton] = useState<ReactElement | null>(null);
    const [isError, setIsError] = useState(false);
    const [isValidCoursePage, setIsValidCoursePage] = useState(false);
    const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
    const [lastAnalyzedAgo, setLastAnalyzedAgo] = useState<string | null>(null);

    async function analyzeCourseData(courseId: string) {
        setIsLoading(true);
        setButton(null);
        setOutputMessage("");

        const restartButton = (
            <Button
                id="restartButton"
                text="Restart"
                onClick={() => analyzeCourseData(courseId)}
            />
        );

        try {
            const {participants: preliminaryUrl} = getScrapeUrlParticipants(courseId);
            const totalParticipants = await scrapeNumParticipants(preliminaryUrl);

            if (totalParticipants === null) {
                console.warn("Unable to extract total participant count.");
                setOutputMessage("Failed to determine participant count.");
                setButton(restartButton);
                return;
            }

            const {participants} = getScrapeUrlParticipants(courseId, totalParticipants);
            const {activityReport} = getScrapeUrlActivityReport(courseId);

            const course = await scrapeCourse(
                courseId,
                activityReport,
                participants,
                totalParticipants
            );

            console.log("Course data:", course);

            chrome.storage.local.set(
                {
                    [`course_${courseId}`]: course,
                    lastAnalyzedCourseId: courseId,
                    lastAnalyzedAt: Date.now()
                },
                () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error saving course data:", chrome.runtime.lastError);
                    } else {
                        console.log(`Course data saved successfully under key "course_${courseId}"`);
                    }
                }
            );

            setOutputMessage("Analysis completed successfully!");
            setButton(restartButton);
            setLastAnalyzedAgo(getRelativeTime(new Date()));

        } catch (error) {
            console.error("Error during analysis:", error);
            setOutputMessage("An error occurred while analyzing the course.");
        } finally {
            setIsLoading(false);
        }
    }

    const showError = (msg: string) => {
        setOutputMessage(msg);
        setIsError(true);
    };

    const setupStartButton = (courseId: string) => {
        setButton(
            <Button
                id="startButton"
                text="Start"
                onClick={() => analyzeCourseData(courseId)}
            />
        );
    };

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const url = tab?.url;

            if (!url || !url.startsWith("http")) {
                showError("No active tab found or the URL is not valid.");
                return;
            }

            const { isCoursePage, courseId } = extractMoodleCourseId(url);

            if (!isCoursePage) {
                showError("This page is not recognized as part of a Moodle course.");
                return;
            }

            if (!courseId) {
                showError("Unable to detect a course ID in the current Moodle URL.");
                return;
            }

            setIsValidCoursePage(true);
            setCurrentCourseId(courseId);

            chrome.storage.local.get("lastAnalyzedCourseId", (res) => {
                if (!res.lastAnalyzedCourseId) {
                    setupStartButton(courseId);
                }
            });
        });
    }, []);

    useEffect(() => {
        if (!isValidCoursePage || !currentCourseId) return;

        chrome.storage.local.get([`course_${currentCourseId}`, "lastAnalyzedAt"], (data) => {
            const course = data[`course_${currentCourseId}`];
            const timestamp = data.lastAnalyzedAt;

            if (course) {
                console.log("Restoring previous course data:", course);

                setButton(
                    <Button
                        id="restartButton"
                        text="Restart"
                        onClick={() => analyzeCourseData(currentCourseId)}
                    />
                );

                setOutputMessage("restored");

                if (timestamp) {
                    const ago = getRelativeTime(new Date(timestamp));
                    setLastAnalyzedAgo(ago);
                }
            }
        });
    }, [isValidCoursePage, currentCourseId]);

    useEffect(() => {
        if (!isValidCoursePage || !currentCourseId) return;

        const interval = setInterval(() => {
            chrome.storage.local.get("lastAnalyzedAt", (data) => {
                const timestamp = data.lastAnalyzedAt;
                if (timestamp) {
                    const ago = getRelativeTime(new Date(timestamp));
                    setLastAnalyzedAgo(ago);
                }
            });
        }, 60 * 1000);

        return () => clearInterval(interval);
    }, [isValidCoursePage, currentCourseId]);

    return (
        <div className="bg-white rounded-xl shadow-xl p-4 text-center w-fit h-fit">
            <h1 className="text-[20px] mb-4 text-[#f98012] font-extrabold">Moodle Data Analyzer</h1>

            {isLoading && <Loader/>}
            {!isLoading && button}
            {outputMessage && outputMessage !== "restored" && (
                <InfoCard message={outputMessage} isError={isError}/>
            )}

            {!isLoading && lastAnalyzedAgo && !isError && (
                <p className="text-xs text-gray-500 mt-2">
                    Último análisis realizado hace {lastAnalyzedAgo}
                </p>
            )}

            {!isLoading && outputMessage && !isError && <TabSection/>}
        </div>
    );
}