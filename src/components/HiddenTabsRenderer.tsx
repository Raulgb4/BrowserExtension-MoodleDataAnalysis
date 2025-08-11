/**
 * @file HiddenTabsRenderer.tsx
 * @description
 * Internal utility component that pre-renders all inactive tab contents in the background.
 * Used in the Moodle Data Analyzer extension to allow access to hidden chart data
 * (e.g., for exporting all charts at once) without displaying them on screen.
 *
 * The component renders all tabs *except* the currently active one inside a visually hidden container.
 * This ensures that the associated charts are mounted and their refs can be accessed for operations
 * such as image conversion or data export, even though the content is not visible to the user.
 *
 * Styling uses Tailwind classes to hide the content non-visibly while keeping it in the DOM.
 * Not meant for user interaction — purely functional/rendering logic.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import TabContent from "./TabContent";

const allTabs = [
    "tab_global",
    "tab_participants",
    "tab_choices",
    "tab_quizzes",
    "tab_forums",
    "tab_other_activities",
];

interface HiddenTabsRendererProps {
    activeTab: string;
}

const HiddenTabsRenderer: React.FC<HiddenTabsRendererProps> = ({activeTab}) => {
    return (
        <div
            className="absolute opacity-0 pointer-events-none h-0 overflow-hidden"
            aria-hidden="true"
        >
            {allTabs
                .filter((tab) => tab !== activeTab)
                .map((tab) => (
                    <TabContent key={tab} tab={tab}/>
                ))}
        </div>
    );
};

export default HiddenTabsRenderer;
