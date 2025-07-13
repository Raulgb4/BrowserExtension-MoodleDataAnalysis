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

interface Choice {
    activityName: string;
    responseCounts: Record<string, number>;
}

const ChoicesTab: React.FC = () => {
    const [choices, setChoices] = useState<Choice[]>([]);

    useEffect(() => {
        chrome.storage.local.get(null, (result) => {
            const courseKey = Object.keys(result).find(key => key.startsWith("course_"));
            if (!courseKey) return;

            const course = result[courseKey];
            const realChoices = course.choices || [];

            // Filtramos solo aquellos que tengan respuestas válidas
            const filteredChoices = realChoices.filter((c: any) =>
                c.responseCounts && Object.keys(c.responseCounts).length > 0
            );

            setChoices(filteredChoices);
        });
    }, []);

    return (
        <div>
            {choices.map((choice, index) => {
                const labels = Object.keys(choice.responseCounts);
                const values = Object.values(choice.responseCounts);

                const data = {
                    labels,
                    datasets: [
                        {
                            label: "Responses",
                            data: values,
                            backgroundColor: "rgba(249, 128, 18, 0.6)",
                            borderColor: "rgba(249, 128, 18, 1)",
                            borderWidth: 1,
                        },
                    ],
                };

                return (
                    <div key={index}>
                        <GraphBlock
                            title={`"${choice.activityName}" Results`}
                            chartType="bar"
                            data={data}
                            labels={labels}
                            values={values}
                        />

                        {index < choices.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto"/>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ChoicesTab;
