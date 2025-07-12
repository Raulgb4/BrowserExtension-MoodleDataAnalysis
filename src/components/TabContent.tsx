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


interface TabContentProps {
    tab: string;
}

const tabComponents: Record<string, React.FC> = {
    Global: GlobalTab,
    Participants: ParticipantsTab,
    Choices: ChoicesTab,
    Quizzes: QuizzesTab,
    Forums: ForumsTab,
    "Other Activities": OtherActivitiesTab,
};

const TabContent: React.FC<TabContentProps> = ({tab}) => {
    const Component = tabComponents[tab];

    return Component ? <Component/> : <p>Selecciona una pestaña para ver el contenido.</p>;
};

export default TabContent;
