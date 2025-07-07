/**
 * @file App.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, {ReactElement, useEffect} from "react";
import {extractCourseId, isCoursePage, getScrapeUrls} from "./utils/urlBuilder";
import {scrapeCourse, scrapeNumParticipants} from "./services/dataExtractor";
import Button from "./components/Button";
import Loader from "./components/Loader";
import InfoCard from "./components/InfoCard";

/**
 * @function App
 * @description
 * The main React component responsible for rendering the user interface of the Moodle Data Analyzer extension.
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
    const [isLoading, setIsLoading] = React.useState(false);
    const [outputMessage, setOutputMessage] = React.useState("");
    const [button, setButton] = React.useState<ReactElement | null>(null);
    const [isError, setIsError] = React.useState(false);

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
            const preliminaryUrl = getScrapeUrls(courseId).participants;
            const totalParticipants = await scrapeNumParticipants(preliminaryUrl);

            if (totalParticipants === null) {
                console.warn("Unable to extract total participant count.");
                setOutputMessage("Failed to determine participant count.");
                setButton(restartButton);
                return;
            }

            const urls = getScrapeUrls(courseId, totalParticipants);
            const course = await scrapeCourse(
                courseId,
                urls.activityReport,
                urls.participants,
                totalParticipants
            );

            console.log("Course data:", course);
            setOutputMessage("Analysis complete. Check the logs for detailed data.");
            setButton(restartButton);

        } catch (error) {
            console.error("Error during analysis:", error);
            setOutputMessage("An error occurred while analyzing the course.");
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Displays an error message and sets the error flag.
     * @param msg The message to show in the UI.
     */
    function showError(msg: string) {
        setOutputMessage(msg);
        setIsError(true);
    }

    useEffect(() => {

        console.info("[Popup] Initializing analysis extension...");

        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {

            const currentTab = tabs[0];
            const currentUrl = currentTab?.url;
            const isValidTab = !!currentTab && !!currentUrl;

            if(!isValidTab){
                showError("No active tab found or it has no URL");
                return;
            }

            console.info(`[Popup] Active tab URL: ${currentUrl}`);

            const courseUrl = currentUrl;
            const validCoursePage = isCoursePage(courseUrl);

            if (!validCoursePage) {
                showError("This is not a Moodle course page.");
                return;
            }

            const courseId = extractCourseId(courseUrl);

            if (!courseId) {
                showError("No course found or it has no course id.");
                return;
            }

            console.info(`[Popup] Course ID detected: ${courseId}`);

            setButton(
                <Button
                    id="startButton"
                    text="Start"
                    onClick={() => analyzeCourseData(courseId)}
                ></Button>
            );
        });
    }, [] );

    return (
        <div className="bg-white rounded-xl shadow-xl p-4 text-center overflow-auto h-full">
            <h1 className="text-[20px] mb-4 text-[#f98012] font-extrabold">Moodle Data Analyzer</h1>
            {isLoading && <Loader/>}
            {!isLoading && button}
            {outputMessage && <InfoCard message={outputMessage} isError={isError} />}
        </div>
    );
}