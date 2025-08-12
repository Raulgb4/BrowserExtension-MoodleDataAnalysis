/**
 * @file ChoicesTab.tsx
 *
 * @description ChoicesTab renders bar charts for each Choice activity,
 * visualizing the distribution of student responses based on real scraped data.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, {useEffect, useState} from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";
import {ChartData} from "chart.js";
import {Choice} from "../../models/Choice";
import {useTranslation} from "react-i18next";


const ChoicesTab: React.FC = () => {
    const [choices, setChoices] = useState<Choice[]>([]);
    const {t} = useTranslation();

    // Small helper to consistently build a bar dataset
    const makeBarDataset =
        (label: string, values: number[]) => ({
            label,
            data: values,
            backgroundColor: "rgba(249, 128, 18, 0.6)",
            borderColor: "rgba(249, 128, 18, 1)",
            borderWidth: 1,
        });


    useEffect(() => {
        let isMounted = true;

        // Load course data from local storage
        chrome.storage.local.get(null, (result: Record<string, any>) => {
            // Find the first key that matches the course pattern
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            // Defensive access with optional chaining
            const rawChoices = result[courseKey]?.choices;

            // Ensure we have an array; otherwise, bail out early
            if (!Array.isArray(rawChoices)) return;

            // Filter out choices with no responses; keeps charts meaningful
            const filtered = rawChoices.filter(
                (choice: Choice) =>
                    choice.responseCounts &&
                    Object.keys(choice.responseCounts).length > 0
            );

            // Avoid setting state if the component already unmounted
            if (isMounted) setChoices(filtered);
        });

        // Cleanup to prevent state updates after unmounting
        return () => {
            isMounted = false;
        };
    }, []);

    // Memoized empty dataset to avoid allocating on every render
    const emptyBarData = React.useMemo(
        () => ({
            labels: [] as string[],
            datasets: [makeBarDataset(t("legend.responses"), [])],
        }),
        [t]
    );

    return (
        <div className="space-y-8">
            {/* Empty chart block when there are no choices */}
            {choices.length === 0 && (
                <>
                    <GraphBlock title={t("chart.choice_results")} chartType="bar" data={emptyBarData}/>
                    <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                </>
            )}

            {choices.map((choice, index) => {
                // Extract labels and values from responseCounts object
                const labels = Object.keys(choice.responseCounts);
                const values = Object.values(choice.responseCounts);

                const data: ChartData<"bar"> = {
                    labels,
                    datasets: [makeBarDataset(t("legend.responses"), values)],
                };

                return (
                    <React.Fragment key={choice.id}>
                        {/* Title uses i18n with activity name interpolation */}
                        <GraphBlock
                            title={t("chart.choice_activity_results", {name: choice.activityName})}
                            chartType="bar"
                            data={data}
                        />
                        {/* Visual separator between charts; the last item omits the rule */}
                        {index < choices.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default ChoicesTab;
