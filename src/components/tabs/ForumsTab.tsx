/**
 * @file ForumsTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";

/*
TODO:
ForumsTab
Objetivo docente: Analizar participación en foros.

Gráficas sugeridas:
1. Barras: Número de mensajes por estudiante.
2. Barras por foro: Publicaciones totales por foro.
3. (Opcional) Dispersión: mensajes vs. respuestas recibidas.
*/

const ForumsTab: React.FC = () => {
    const labels = ["Student A", "Student B", "Student C", "Student D"];
    const values = [5, 12, 3, 7];

    const data = {
        labels,
        datasets: [
            {
                label: "Posts published",
                data: values,
                backgroundColor: "rgba(249, 128, 18, 0.6)", // UMA orange
                borderColor: "rgba(249, 128, 18, 1)",
                borderWidth: 1,
            },
        ],
    };

    return (
        <div>
            <GraphBlock
                title="Forum Participation (Mock Data)"
                chartType="bar"
                data={data}
                labels={labels}
                values={values}
            />
        </div>
    );
};

export default ForumsTab;
