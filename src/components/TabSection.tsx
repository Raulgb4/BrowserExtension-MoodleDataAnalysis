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

const tabs = [
    "Global",
    "Participants",
    "Choices",
    "Quizzes",
    "Forums",
    "Other Activities",
] as const;

type Tab = typeof tabs[number];

const TabSection: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>("Global");

    useEffect(() => {
        chrome.storage.local.get("activeTab", ({activeTab}) => {
            if (tabs.includes(activeTab)) {
                setActiveTab(activeTab as Tab);
            }
        });
    }, []);


    useEffect(() => {
        chrome.storage.local
            .set({activeTab})
            .catch((err) => console.error("Error saving activeTab:", err));
    }, [activeTab]);

    return (
        <div className="mt-6">
            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-6 justify-center" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-2 text-sm font-medium transition-all ${
                                    isActive
                                        ? "text-orange-600 border-b-2 border-orange-600"
                                        : "text-gray-500 hover:text-orange-600 border-b-2 border-transparent"
                                }`}
                            >
                                <span className="whitespace-nowrap">{tab}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab content */}
            <div className="mt-4 text-sm text-gray-700">
                <TabContent tab={activeTab}/>
            </div>
        </div>
    );
};

export default TabSection;
