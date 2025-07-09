import React, { useState } from "react";
import TabContent from "./TabContent";

const tabs = ["Global", "Choices", "Quizzes", "Forums"];

const TabSection: React.FC = () => {
    const [activeTab, setActiveTab] = useState("Global");

    return (
        <div className="mt-6">
            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-6 justify-center" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-2 text-sm font-medium transition-all
                ${
                                activeTab === tab
                                    ? "text-orange-600 border-b-2 border-orange-600"
                                    : "text-gray-500 hover:text-orange-600 border-b-2 border-transparent"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab content */}
            <div className="mt-4 text-sm text-gray-700">
                <TabContent tab={activeTab} />
            </div>
        </div>
    );
};

export default TabSection;
