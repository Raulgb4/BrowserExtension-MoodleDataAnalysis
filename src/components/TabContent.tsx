/**
 * @file TabContent.tsx
 * @description
 * This component is responsible for rendering the appropriate content tab
 * based on the currently selected tab label. It maps tab names to their
 * corresponding components and displays them dynamically.
 * Used in the main interface to switch between different data visualizations
 * like Global stats, Participants, Quizzes, Forums, and more.
 * @author Raúl García Balongo
 * @date 2025
 */
import ParticipantsTab from "./tabs/ParticipantsTab";
import React from "react";
import ChoicesTab from "./tabs/ChoicesTab";
import ForumsTab from "./tabs/ForumsTab";
import QuizzesTab from "./tabs/QuizzesTab";
import OtherActivitiesTab from "./tabs/OtherActivitiesTab";
import GlobalTab from "./tabs/GlobalTab";
import {useExportContext} from "../context/ExportContext";


interface TabContentProps {
    tab: string;
}

// Map tab keys to components
const tabComponents: Record<string, React.FC<{ activeTab: string }>> = {
    tab_global: GlobalTab,
    tab_participants: ParticipantsTab,
    tab_choices: ChoicesTab,
    tab_quizzes: QuizzesTab,
    tab_forums: ForumsTab,
    tab_other_activities: OtherActivitiesTab,
};

const TabContent: React.FC<TabContentProps> = ({ tab }) => {
    const { forceRenderTabs } = useExportContext();

    // Combine current tab and forced ones, without duplicates
    const allTabsToRender = Array.from(new Set([tab, ...forceRenderTabs]));

    return (
        <>
            {allTabsToRender.map((key) => {
                const Component = tabComponents[key];
                if (!Component) return null;

                const isVisible = key === tab;

                return (
                    <div key={key} className={isVisible ? "" : "hidden"}>
                        <Component activeTab={tab} />
                    </div>
                );
            })}
        </>
    );
};

export default TabContent;
