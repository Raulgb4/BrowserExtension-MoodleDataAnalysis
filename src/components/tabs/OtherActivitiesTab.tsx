/**
 * @file OtherActivitiesTab.tsx
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
OtherActivitiesTab (UrlResources, Resources, Workshops)
Objetivo docente: Evaluar el uso de recursos.

Gráficas sugeridas:
1. URL Resources → Barras: Visitas por enlace.
2. Resources → Barras: Descargas por archivo.
3. Workshops → Barras: Entregas por taller.
*/

const OtherActivitiesTab: React.FC = () => {

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

    // ─── File Resources ─────────────────────────────────────
    const fileLabels = ["Document A", "Slides B", "Guide C"];
    const fileValues = [40, 22, 15];
    const fileData = {
        labels: fileLabels,
        datasets: [
            {
                label: "Downloads",
                data: fileValues,
                backgroundColor: "rgba(255, 167, 38, 0.6)",
                borderColor: "rgba(255, 167, 38, 1)",
                borderWidth: 1,
            },
        ],
    };

    // ─── Workshops ──────────────────────────────────────────
    const workshopLabels = ["Workshop X", "Workshop Y"];
    const workshopValues = [10, 14];
    const workshopData = {
        labels: workshopLabels,
        datasets: [
            {
                label: "Submissions",
                data: workshopValues,
                backgroundColor: "rgba(129, 199, 132, 0.6)",
                borderColor: "rgba(129, 199, 132, 1)",
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

            <GraphBlock
                title="File Resource Downloads (Mock Data)"
                chartType="bar"
                data={fileData}
                labels={fileLabels}
                values={fileValues}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            <GraphBlock
                title="Workshop Submissions (Mock Data)"
                chartType="bar"
                data={workshopData}
                labels={workshopLabels}
                values={workshopValues}
            />
        </div>
    );
};

export default OtherActivitiesTab;
