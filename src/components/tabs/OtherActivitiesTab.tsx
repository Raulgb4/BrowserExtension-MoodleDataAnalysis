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
import "../../chartConfig";

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
    // ─── Mock data ────────────────────────────────────────────
    const mockUrlResources = [
        {
            activityName: "Presentación de TALF",
            numViews: 631,
            numUsers: 171,
            lastAccess: 363600000,
        },
        {
            activityName: "Apuntes y scripts (repo en bitbucket)",
            numViews: 760,
            numUsers: 157,
            lastAccess: 1472400000,
        },
    ];

    const mockResources = [
        {
            activityName: "Copia local del repo talfuma",
            numViews: 181,
            numUsers: 86,
            lastAccess: 428400000,
        },
        {
            activityName: "Apuntes de TALF (fichero PDF accesible desde lab, última versión)",
            numViews: 4806,
            numUsers: 203,
            lastAccess: 788400000,
        },
    ];

    const mockWorkshops = [
        {
            activityName: "Taller Bloque 1",
            numViews: 1005,
            numUsers: 39,
            lastAccess: 428400000,
        },
        {
            activityName: "Taller Bloque 2",
            numViews: 699,
            numUsers: 37,
            lastAccess: 1472400000,
        },
    ];

    // ─── Datos para cada gráfica ──────────────────────────────

    const getBarData = (
        items: typeof mockUrlResources,
        label: string,
        background: string,
        border: string
    ) => ({
        labels: items.map(i => i.activityName),
        datasets: [
            {
                label,
                data: items.map(i => i.numViews),
                backgroundColor: background,
                borderColor: border,
                borderWidth: 1,
            },
        ],
    });

    return (
        <div>
            <GraphBlock
                title="URL Resource Visits (Mock Data)"
                chartType="bar"
                data={getBarData(
                    mockUrlResources,
                    "Visits",
                    "rgba(100, 181, 246, 0.6)",
                    "rgba(100, 181, 246, 1)"
                )}
                labels={mockUrlResources.map(i => i.activityName)}
                values={mockUrlResources.map(i => i.numViews)}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            <GraphBlock
                title="File Resource Visits (Mock Data)"
                chartType="bar"
                data={getBarData(
                    mockResources,
                    "Visits",
                    "rgba(255, 167, 38, 0.6)",
                    "rgba(255, 167, 38, 1)"
                )}
                labels={mockResources.map(i => i.activityName)}
                values={mockResources.map(i => i.numViews)}
            />

            <hr className="my-6 border-t border-gray-300 w-3/4 mx-auto" />

            <GraphBlock
                title="Workshop Visits (Mock Data)"
                chartType="bar"
                data={getBarData(
                    mockWorkshops,
                    "Visits",
                    "rgba(129, 199, 132, 0.6)",
                    "rgba(129, 199, 132, 1)"
                )}
                labels={mockWorkshops.map(i => i.activityName)}
                values={mockWorkshops.map(i => i.numViews)}
            />
        </div>
    );
};

export default OtherActivitiesTab;

