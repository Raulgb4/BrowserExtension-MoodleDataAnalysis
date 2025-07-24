/**
 * @file TabSection.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 *
 * @description
 * This component renders the tab navigation interface and manages the currently active tab.
 * It displays a horizontal tab bar with section labels and shows the corresponding tab content
 * by delegating rendering to the TabContent component based on user interaction.
 *
 * It uses React state to track the active tab and applies conditional styling for visual feedback.
 */
import React, {useEffect, useState} from "react";
import TabContent from "./TabContent";
import {
    GlobeAltIcon,
    UsersIcon,
    AdjustmentsHorizontalIcon,
    QuestionMarkCircleIcon,
    ChatBubbleLeftRightIcon,
    Squares2X2Icon
} from "@heroicons/react/24/solid";
import {useTranslation} from "react-i18next";


// Define available tabs with corresponding icons
const tabs = [
    {key: "tab_global", icon: GlobeAltIcon},
    {key: "tab_participants", icon: UsersIcon},
    {key: "tab_choices", icon: AdjustmentsHorizontalIcon},
    {key: "tab_quizzes", icon: QuestionMarkCircleIcon},
    {key: "tab_forums", icon: ChatBubbleLeftRightIcon},
    {key: "tab_other_activities", icon: Squares2X2Icon},
] as const;

// Extract valid tab names as a type
type Tab = (typeof tabs)[number]["key"];

const TabSection: React.FC = () => {

    const {t} = useTranslation();

    const [activeTab, setActiveTab] = useState<Tab>("tab_global");

    // Load the last selected tab from chrome storage (if available)
    useEffect(() => {
        chrome.storage.local.get("activeTab", ({activeTab}) => {
            if (tabs.find(tab => tab.key === activeTab)) {
                setActiveTab(activeTab as Tab);
            }
        });
    }, []);

    // Persist current tab selection to chrome storage
    useEffect(() => {
        chrome.storage.local
            .set({activeTab})
            .catch((err) => console.error("Error saving activeTab:", err));
    }, [activeTab]);

    return (
        <div className="mt-6">
            {/* Tab buttons */}
            <div
                className="border-b border-gray-200 overflow-x-auto"
                style={{
                    scrollbarWidth: "thin",
                }}
            >
                <nav
                    className="flex px-4 gap-4 sm:gap-6 w-max pb-3"
                    aria-label="Tabs"
                >
                    {tabs.map(({key, icon: Icon}) => {
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-1.5 pb-2 text-sm font-medium whitespace-nowrap transition-all ${
                                    isActive
                                        ? "text-orange-600 border-b-2 border-orange-600"
                                        : "text-gray-500 hover:text-orange-600 border-b-2 border-transparent"
                                }`}
                            >
                                <Icon className="w-4 h-4" aria-hidden="true"/>
                                <span>{t(key)}</span> {/* Traducción aquí */}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Dynamic content based on a selected tab */}
            <div className="mt-4 text-sm text-gray-700">
                <TabContent tab={activeTab}/>
            </div>
        </div>
    );
};

export default TabSection;
