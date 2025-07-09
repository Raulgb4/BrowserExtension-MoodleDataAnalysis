/**
 * @file TabContent.tsx
 *
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

const TabContent: React.FC<TabContentProps> = ({tab}) => {
    switch (tab) {
        case "Global":
            return <GlobalTab/>;
        case "Participants":
            return <ParticipantsTab/>;
        case "Choices":
            return <ChoicesTab/>;
        case "Quizzes":
            return <QuizzesTab/>;
        case "Forums":
            return <ForumsTab/>;
        case "Other Activities":
            return <OtherActivitiesTab/>
        default:
            return <p>Selecciona una pestaña para ver el contenido.</p>;
    }
};

export default TabContent;
