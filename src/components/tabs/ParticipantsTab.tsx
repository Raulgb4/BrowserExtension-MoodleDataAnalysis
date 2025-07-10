/**
 * @file ParticipantsTab.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React from "react";
import GraphBlock from "../GraphBlock";
import "../../chartConfig";

/*
TODO:
ParticipantsTab
Objetivo docente: Saber cuántos estudiantes están accediendo al curso.

Gráficas sugeridas:
1. Diagrama de sectores: Participantes activos vs. inactivos.
2. Barras: Frecuencia de accesos por participante (si hay datos de acceso).
3. Histograma del número de vistas totales por usuario.
*/

const ParticipantsTab: React.FC = () => {
    const numParticipantsTotal = 215;
    const numParticipantsActive = 32;
    const numParticipantsInactive = numParticipantsTotal - numParticipantsActive;

    const labels = ["Active", "Inactive"];
    const values = [numParticipantsActive, numParticipantsInactive];

    const data = {
        labels,
        datasets: [
            {
                label: "Participants",
                data: values,
                backgroundColor: [
                    "rgba(249, 128, 18, 0.6)", // naranja activo
                    "rgba(203, 213, 225, 0.8)", // gris inactivo
                ],
                borderColor: "white",
                borderWidth: 2,
            },
        ],
    };

    return (
        <div>
            <GraphBlock
                title="Global Participation (Mock Data)"
                chartType="pie"
                data={data}
                labels={labels}
                values={values}
            />
        </div>
    );
};

export default ParticipantsTab;
