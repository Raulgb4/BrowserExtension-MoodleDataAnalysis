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
import React, {useEffect, useMemo, useRef, useState} from "react";
import TabContent from "./TabContent";
import {
    AdjustmentsHorizontalIcon,
    ChatBubbleLeftRightIcon,
    GlobeAltIcon,
    PresentationChartLineIcon,
    QuestionMarkCircleIcon,
    Squares2X2Icon,
    UsersIcon,
} from "@heroicons/react/24/solid";
import {useTranslation} from "react-i18next";
import HiddenTabsRenderer from "./HiddenTabsRenderer";

import {
    getCurrentCourse,
    hasDataChoices,
    hasDataCorrelations,
    hasDataForums,
    hasDataGlobal,
    hasDataOtherActivities,
    hasDataParticipants,
    hasDataQuizzes,
} from "../utils/tabDataGuards";

// Static definition of all available tabs (key + icon + guard).
// Each guard decides if the tab has meaningful data for the current course.
const ALL_TABS = [
    {key: "tab_global", icon: GlobeAltIcon, guard: hasDataGlobal},
    {key: "tab_participants", icon: UsersIcon, guard: hasDataParticipants},
    {key: "tab_choices", icon: AdjustmentsHorizontalIcon, guard: hasDataChoices},
    {key: "tab_quizzes", icon: QuestionMarkCircleIcon, guard: hasDataQuizzes},
    {key: "tab_forums", icon: ChatBubbleLeftRightIcon, guard: hasDataForums},
    {key: "tab_other_activities", icon: Squares2X2Icon, guard: hasDataOtherActivities},
    {key: "tab_correlations", icon: PresentationChartLineIcon, guard: hasDataCorrelations},
] as const;

// Union type of tab keys inferred from ALL_TABS.
export type Tab = (typeof ALL_TABS)[number]["key"];

// Fixed width used ONLY for the very first paint to avoid a “narrow-to-wide” flicker.
const TABBAR_PIXEL_WIDTH = 520;

const TabSection: React.FC = () => {
    const {t} = useTranslation();

    // Selected tab and the set of tabs that actually have data.
    const [activeTab, setActiveTab] = useState<Tab>("tab_global");
    const [visibleTabs, setVisibleTabs] = useState<Tab[]>([]); // empty until guards resolve

    // We keep a ref in case you later want to measure, but we can simplify scrolling logic.
    const scrollRef = useRef<HTMLDivElement>(null);

    // Restore the last-selected tab (if it still exists in ALL_TABS).
    useEffect(() => {
        chrome.storage.local.get("activeTab", ({activeTab}) => {
            if (ALL_TABS.some(tab => tab.key === activeTab)) {
                setActiveTab(activeTab as Tab);
            }
        });
    }, []);

    // Persist the current tab on change.
    useEffect(() => {
        chrome.storage.local.set({activeTab}).catch(err => console.error("Error saving activeTab:", err));
    }, [activeTab]);

    // Compute the real list of visible tabs once on mount.
    // We render nothing until this finishes to prevent layout jumps.
    useEffect(() => {
        (async () => {
            const course = await getCurrentCourse();
            if (!course) {
                setVisibleTabs(["tab_global"]);
                return;
            }

            const computed = ALL_TABS
                .filter(t => t.key === "tab_global" || t.guard(course))
                .map(t => t.key as Tab);

            const finalTabs = computed.length ? computed : (["tab_global"] as Tab[]);
            setVisibleTabs(finalTabs);

            // Keep the restored active tab if still valid; otherwise select the first visible one.
            setActiveTab(prev => (finalTabs.includes(prev) ? prev : finalTabs[0]));
        })();
    }, []);

    // Map tab key -> icon component (memoized).
    const iconByKey = useMemo(() => {
        const map = new Map<string, React.ComponentType<any>>();
        ALL_TABS.forEach(({key, icon}) =>
            map.set(key, icon));
        return map;
    }, []);

    // Apply a fixed width ONLY while visibleTabs is empty to avoid the initial flicker.
    const initialBarWidthStyle =
        visibleTabs.length === 0
            ? {
                width: `${TABBAR_PIXEL_WIDTH}px`,
                minWidth: `${TABBAR_PIXEL_WIDTH}px`,
                maxWidth: `${TABBAR_PIXEL_WIDTH}px`,
            }
            : undefined;

    return (
        <div className="mt-6">
            {/* Tabs bar */}
            <div
                ref={scrollRef}
                // Always allow horizontal scroll; this removes the need to track canScroll via observers.
                className="border-b border-gray-200 overflow-x-auto"
                style={{
                    scrollbarWidth: "thin",
                    scrollbarGutter: "stable both-edges",
                    ...initialBarWidthStyle, // fixed width on first paint only
                }}
            >
                <nav
                    // inline-flex and min-w-max ensures tabs don’t shrink and keeps a stable row height.
                    // min-h avoids vertical jump
                    className="inline-flex min-w-max gap-4 sm:gap-6 pb-3 px-2 min-h-[40px]"
                    aria-label="Tabs"
                >
                    {visibleTabs.map((key) => {
                        const Icon = iconByKey.get(key)!;
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-1.5 text-sm font-medium whitespace-nowrap
        transition-all px-2 pt-1 pb-3 border-b-2
        ${
                                    isActive
                                        ? "text-orange-600 border-orange-600"
                                        : "text-gray-500 hover:text-orange-600 border-transparent"
                                }`}
                            >
                                <Icon className="w-4 h-4" aria-hidden="true"/>
                                <span>{t(key)}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Dynamic content */}
            <div className="mt-4 text-sm text-gray-700">
                <TabContent tab={activeTab}/>
                <HiddenTabsRenderer activeTab={activeTab}/>
            </div>
        </div>
    );
};

export default TabSection;
