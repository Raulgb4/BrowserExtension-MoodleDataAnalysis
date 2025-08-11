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
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import TabContent from "./TabContent";
import {
    AdjustmentsHorizontalIcon,
    ChatBubbleLeftRightIcon,
    GlobeAltIcon,
    QuestionMarkCircleIcon,
    Squares2X2Icon,
    UsersIcon
} from "@heroicons/react/24/solid";
import {useTranslation} from "react-i18next";
import HiddenTabsRenderer from "./HiddenTabsRenderer";

import {
    getCurrentCourse,
    hasDataChoices,
    hasDataForums,
    hasDataGlobal,
    hasDataOtherActivities,
    hasDataParticipants,
    hasDataQuizzes,
} from "../utils/tabDataGuards";

// Static definition of all available tabs (key + icon + guard)
const ALL_TABS = [
    {key: "tab_global", icon: GlobeAltIcon, guard: hasDataGlobal},
    {key: "tab_participants", icon: UsersIcon, guard: hasDataParticipants},
    {key: "tab_choices", icon: AdjustmentsHorizontalIcon, guard: hasDataChoices},
    {key: "tab_quizzes", icon: QuestionMarkCircleIcon, guard: hasDataQuizzes},
    {key: "tab_forums", icon: ChatBubbleLeftRightIcon, guard: hasDataForums},
    {key: "tab_other_activities", icon: Squares2X2Icon, guard: hasDataOtherActivities},
] as const;

// Extract valid tab names as a union type
export type Tab = (typeof ALL_TABS)[number]["key"];

const TabSection: React.FC = () => {
    const {t} = useTranslation();

    // Currently selected tab
    const [activeTab, setActiveTab] = useState<Tab>("tab_global");
    // Tabs that should be shown given current course data
    const [visibleTabs, setVisibleTabs] = useState<Tab[]>(["tab_global"]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScroll, setCanScroll] = useState(false);

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const update = () => {
            // margen de 1px para evitar scroll por redondeos
            setCanScroll(el.scrollWidth > el.clientWidth + 1);
        };

        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener("resize", update);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", update);
        };
    }, [visibleTabs.length]);


    /**
     * Loads the last selected tab from storage (if any) on mount.
     * Only applies it if the key is part of ALL_TABS.
     */
    useEffect(() => {
        chrome.storage.local.get("activeTab", ({activeTab}) => {
            if (ALL_TABS.find((tab) => tab.key === activeTab)) {
                setActiveTab(activeTab as Tab);
            }
        });
    }, []);

    /**
     * Persists the currently selected tab so it is restored next time.
     */
    useEffect(() => {
        chrome.storage.local
            .set({activeTab})
            .catch((err) => console.error("Error saving activeTab:", err));
    }, [activeTab]);

    /**
     * Computes which tabs have data for the current course and should be visible.
     * Ensures there is always at least "tab_global" and keeps activeTab valid.
     */
    const recomputeVisibleTabs = useCallback(async () => {
        const course = await getCurrentCourse();

        // Keep Global always, add other tabs only if their guard passes.
        const computed = ALL_TABS
            .filter((t) => t.key === "tab_global" || (course && t.guard(course)))
            .map((t) => t.key as Tab);

        const finalTabs = computed.length ? computed : (["tab_global"] as Tab[]);
        setVisibleTabs(finalTabs);

        // If the current active tab is no longer visible, switch to the first visible
        setActiveTab((prev) =>
            (finalTabs.includes(prev) ? prev : finalTabs[0]));
    }, []);

    /**
     * Initial computation on mount.
     */
    useEffect(() => {
        void recomputeVisibleTabs();
    }, [recomputeVisibleTabs]);

    /**
     * Re-compute visibility whenever course-related storage keys change.
     * We listen to changes in chrome.storage.local and react if any key starts with "course_".
     */
    useEffect(() => {
        const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] =
            (changes, areaName) => {
                if (areaName !== "local") return;
                const touchesCourse = Object.keys(changes).some((k) =>
                    k.startsWith("course_"));
                if (touchesCourse) void recomputeVisibleTabs();
            };

        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, [recomputeVisibleTabs]);

    // Convenience map from key to icon (for render)
    const iconByKey = useMemo(() => {
        const map = new Map<string, React.ComponentType<any>>();
        ALL_TABS.forEach(({key, icon}) =>
            map.set(key, icon));
        return map;
    }, []);

    return (
        <div className="mt-6">
            {/* Tab buttons */}
            <div
                ref={scrollRef}
                className={`border-b border-gray-200 ${canScroll ? "overflow-x-auto" : "overflow-x-hidden"}`}
                style={{scrollbarWidth: "thin", scrollbarGutter: "stable both-edges"}}
            >
                {/* Cambios clave: inline-flex + min-w-max y menos padding */}
                <nav className="inline-flex min-w-max gap-4 sm:gap-6 pb-3 px-2" aria-label="Tabs">
                    {visibleTabs.map((key) => {
                        const Icon = iconByKey.get(key)!;
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-1.5 pb-2 text-sm font-medium whitespace-nowrap 
                                transition-all ${
                                    isActive
                                        ? "text-orange-600 border-b-2 border-orange-600"
                                        : "text-gray-500 hover:text-orange-600 border-b-2 border-transparent"
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
