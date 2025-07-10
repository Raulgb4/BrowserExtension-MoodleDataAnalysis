/**
 * @file GlobalTab.tsx
 *
 * @description
 * Displays bar charts for additional Moodle activities: URL resources, files, and workshops.
 * Uses the reusable GraphBlock component for consistent layout and export functionality.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

/*
TODO:
GlobalTab (UrlResources, Resources, Workshops)
Resumen global con:
- Total de vistas por tipo de actividad.
- Participación media por actividad.
- Comparativa entre foros, quizzes y elecciones.
*/

const GlobalTab: React.FC = () => {
    const activityName = ["Choices", "Quizzes", "Forums", "URL Resources", "Resources", "Workshops"];

    // Total number of visits per activity type (mock)
    const numViews = [64, 105, 89, 74, 52, 38];

    // Number of unique users who accessed each activity (mock)
    const numUsers = [25, 35, 42, 30, 28, 19];

    // Average views per user
    const avgViewsPerUser = numViews.map((views, i) =>
        numUsers[i] !== 0 ? parseFloat((views / numUsers[i]).toFixed(2)) : 0
    );

    const totalViewsData = {
        labels: activityName,
        datasets: [
            {
                label: "Total Visits",
                data: numViews,
                backgroundColor: "rgba(249, 128, 18, 0.6)",
                borderColor: "rgba(249, 128, 18, 1)",
                borderWidth: 1,
            },
        ],
    };

    const avgViewsData = {
        labels: activityName,
        datasets: [
            {
                label: "Average Views per User",
                data: avgViewsPerUser,
                fill: false,
                borderColor: "rgba(100, 181, 246, 1)",
                backgroundColor: "rgba(100, 181, 246, 0.6)",
                tension: 0.3, // suaviza la curva
            },
        ],
    };

    return (
        <div>
            <GraphBlock
                title="Total Visits by Activity Type (Mock Data)"
                chartType="bar"
                data={totalViewsData}
                labels={activityName}
                values={numViews}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            <GraphBlock
                title="Average Views per User (Mock Data)"
                chartType="line" // 🎯 ahora es gráfico de línea
                data={avgViewsData}
                labels={activityName}
                values={avgViewsPerUser}
            />
        </div>
    );
};

export default GlobalTab;
