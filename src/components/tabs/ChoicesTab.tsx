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
import { useTranslation } from "react-i18next";


const ChoicesTab: React.FC = () => {
    const [choices, setChoices] = useState<Choice[]>([]);

    const { t } = useTranslation();

    useEffect(() => {
        // Load course data from local storage
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find((key) =>
                key.startsWith("course_")
            );
            if (!courseKey) return;

            const rawChoices = result[courseKey]?.choices;
            if (!Array.isArray(rawChoices)) return;

            // Filter out choices with no responses
            const filtered = rawChoices.filter(
                (choice: Choice) =>
                    choice.responseCounts &&
                    Object.keys(choice.responseCounts).length > 0
            );

            setChoices(filtered);
        });
    }, []);

    return (
        <div className="space-y-8">
            {/* Empty chart block when there are no choices */}
            {choices.length === 0 && (
                <>
                    <GraphBlock
                        title={t("chart.choice_results")}
                        chartType="bar"
                        data={{
                            labels: [],
                            datasets: [
                                {
                                    label: t("legend.responses"),
                                    data: [],
                                    backgroundColor: "rgba(249, 128, 18, 0.6)",
                                    borderColor: "rgba(249, 128, 18, 1)",
                                    borderWidth: 1,
                                },
                            ],
                        }}
                    />
                    <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                </>
            )}

            {choices.map((choice, index) => {
                const labels = Object.keys(choice.responseCounts);
                const values = Object.values(choice.responseCounts);

                const data: ChartData<"bar"> = {
                    labels,
                    datasets: [
                        {
                            label: t("legend.responses"),
                            data: values,
                            backgroundColor: "rgba(249, 128, 18, 0.6)", // orange
                            borderColor: "rgba(249, 128, 18, 1)",
                            borderWidth: 1,
                        },
                    ],
                };

                return (
                    <React.Fragment key={choice.id}>
                        <GraphBlock
                            title={t("chart.choice_activity_results", { name: choice.activityName })}
                            chartType="bar"
                            data={data}
                        />
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
