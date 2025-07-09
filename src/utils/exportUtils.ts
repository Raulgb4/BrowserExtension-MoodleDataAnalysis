// Exportar a CSV
export function exportToCSV(labels: string[], data: number[], filename = "export.csv") {
    const rows = [
        ["Categoría", "Valor"],
        ...labels.map((label, i) => [label, data[i]])
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// (Más adelante puedes añadir aquí exportaciones a imagen, PDF, JSON, etc.)
