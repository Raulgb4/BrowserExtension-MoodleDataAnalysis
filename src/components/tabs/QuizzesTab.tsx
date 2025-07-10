/**
 * @file QuizzesTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

/*
TODO:
QuizzesTab
Objetivo docente: Visualizar rendimiento del alumnado.

Gráficas sugeridas:
1. Barras horizontales: Puntuación por alumno.
2. Boxplot: Distribución de notas por cuestionario.
3. Línea: Evolución media de notas (si hay múltiples quizzes).
*/

const QuizzesTab: React.FC = () => {
    const labels = ["Student A", "Student B", "Student C", "Student D"];
    const values = [8.5, 7.0, 9.2, 6.8];

    const data = {
        labels,
        datasets: [
            {
                label: "Score",
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
                title="Quiz Results (Mock Data)"
                chartType="bar"
                data={data}
                labels={labels}
                values={values}
            />
        </div>
    );
};

export default QuizzesTab;
