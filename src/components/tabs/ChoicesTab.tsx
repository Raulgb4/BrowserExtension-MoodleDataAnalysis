/**
 * @file ChoicesTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

/*
TODO:
ChoicesTab
Objetivo docente: Ver participación y distribución de respuestas.

Gráficas sugeridas:
1. Barras: Número de respuestas por opción.
2. Barras múltiples: Comparativa de participación por elección.
*/

const ChoicesTab: React.FC = () => {
    // Datos ficticios para una actividad tipo "elección"
    const labels = ["Option A", "Option B", "Option C"];
    const values = [12, 8, 5];

    const data = {
        labels,
        datasets: [
            {
                label: "Responses",
                data: values,
                backgroundColor: [
                    "rgba(249, 128, 18, 0.6)", // UMA orange
                    "rgba(249, 186, 75, 0.6)", // lighter tone
                    "rgba(255, 229, 185, 0.6)", // very light
                ],
                borderColor: "white",
                borderWidth: 2,
            },
        ],
    };

    return (
        <div>
            <GraphBlock
                title="Choice Activity Results (Mock Data)"
                chartType="pie"
                data={data}
                labels={labels}
                values={values}
            />
        </div>
    );
};

export default ChoicesTab;
