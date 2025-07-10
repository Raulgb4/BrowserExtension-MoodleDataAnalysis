/**
 * @file ChoicesTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

const ChoicesTab: React.FC = () => {
    // Datos ficticios de 3 actividades tipo Choice
    const choices = [
        {
            title: "Favorite Language",
            responses: {
                "JavaScript": 14,
                "Python": 20,
                "C++": 6,
            },
        },
        {
            title: "Preferred IDE",
            responses: {
                "VS Code": 18,
                "PyCharm": 7,
                "IntelliJ": 9,
            },
        },
        {
            title: "Study Method",
            responses: {
                "Group": 10,
                "Solo": 15,
                "Mixed": 5,
            },
        },
    ];

    return (
        <div>
            {choices.map((choice, index) => {
                const labels = Object.keys(choice.responses);
                const values = Object.values(choice.responses);

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
                            title={`"${choice.title}" Results (Mock Data)`}
                            chartType="bar"
                            data={data}
                            labels={labels}
                            values={values}
                        />

                        {/* Añadir separador excepto después del último */}
                        {index < choices.length - 1 && (
                            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ChoicesTab;
