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

/*
TODO:
GlobalTab (UrlResources, Resources, Workshops)
Resumen global con:
- Total de vistas por tipo de actividad.
- Participación media por actividad.
- Comparativa entre foros, quizzes y elecciones.
*/

const GlobalTab: React.FC = () => {

    // ─── URL Resources ──────────────────────────────────────
    const urlLabels = ["Link 1", "Link 2", "Link 3"];
    const urlValues = [24, 18, 32];
    const urlData = {
        labels: urlLabels,
        datasets: [
            {
                label: "Visits",
                data: urlValues,
                backgroundColor: "rgba(100, 181, 246, 0.6)",
                borderColor: "rgba(100, 181, 246, 1)",
                borderWidth: 1,
            },
        ],
    };


    return (
        <div>
            <GraphBlock
                title="URL Resource Visits (Mock Data)"
                chartType="bar"
                data={urlData}
                labels={urlLabels}
                values={urlValues}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />
        </div>
    );
};

export default GlobalTab;
