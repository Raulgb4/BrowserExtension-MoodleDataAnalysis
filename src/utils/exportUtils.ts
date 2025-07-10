/**
 * @file exportUtils.ts
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart as ChartJS } from "chart.js";
import { RefObject } from "react";

/**
 * @function exportToCSV
 * @description
 * Utility function to export chart data as a CSV file.
 * This function takes an array of labels and corresponding values,
 * builds a valid CSV string, and triggers a file download in the browser.
 *
 * It automatically generates a file with headers,
 * composes the rows from the label-value pairs, and handles the creation
 * and cleanup of a temporary anchor element for triggering the download.
 *
 * @param {string[]} labels - Array of category labels to include in the CSV.
 * @param {number[]} values - Array of numeric values corresponding to each label.
 * @param {string} [filename="export.csv"] - The desired filename for the exported CSV.
 *
 * @returns {void} This function does not return anything; it triggers a download.
 */
export function exportToCSV(
    labels: string[],
    values: number[],
    filename: string = "export.csv"
): void {
    const header = ["Categoría", "Valor"];
    const rows = labels.map((label, i) => [label, values[i]]);

    const csv = [header, ...rows]
        .map((row) => row.join(","))
        .join("\n");

    const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.setAttribute("download", filename);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

/**
 * @function exportToImage
 * @description
 * Utility function to export a Chart.js chart as an image (PNG or JPEG).
 * It uses Chart.js' built-in `toBase64Image()` method to generate
 * a base64-encoded image and triggers a download in the browser.
 *
 * @param {React.RefObject<ChartJS | null>} chartRef - Ref to the rendered chart instance.
 * @param {"png" | "jpeg"} format - Desired image format ("png" or "jpeg").
 * @param {string} [filename="chart"] - Base filename without extension.
 *
 * @returns {void}
 */
export function exportToImage(
    chartRef: React.RefObject<ChartJS | null>,
    format: "png" | "jpeg",
    filename: string = "chart"
): void {
    const chart = chartRef.current;
    if (!chart) {
        console.warn(`Chart reference is not available for ${format.toUpperCase()} export.`);
        return;
    }

    const canvas = chart.canvas as HTMLCanvasElement;

    // Crear un nuevo canvas con fondo blanco
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
        console.warn("Unable to get canvas context for export.");
        return;
    }

    // Pintar fondo blanco y copiar contenido original
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const mimeType = `image/${format}`;
    const base64Image = exportCanvas.toDataURL(mimeType);

    const link = document.createElement("a");
    link.href = base64Image;
    link.download = `${filename}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


/**
 * @function exportToPDF
 * @description
 * Utility function to export a Chart.js chart as a PDF file.
 * The PDF includes the chart image and a data table with corresponding labels and values.
 *
 * It uses `toBase64Image()` from Chart.js to extract the chart visual as an image,
 * and `jspdf-autotable` to render the data in tabular form.
 *
 * @param {React.RefObject<ChartJS | null>} chartRef - Reference to the Chart.js instance.
 * @param {string[]} labels - The labels corresponding to chart data categories.
 * @param {number[]} values - The values associated with each label.
 * @param {string} [filename="chart.pdf"] - Desired filename for the exported PDF.
 *
 * @returns {void}
 */
export function exportToPDF(
    chartRef: RefObject<ChartJS | null>,
    labels: string[],
    values: number[],
    filename: string = "chart.pdf"
): void {
    const chart = chartRef.current;
    if (!chart) {
        console.warn("Chart reference is not available for PDF export.");
        return;
    }

    const base64Image = chart.toBase64Image();
    const doc = new jsPDF();

    // Add the chart image
    const imgProps = (doc as any).getImageProperties?.(base64Image);
    const pdfWidth = 180;
    const aspectRatio = imgProps ? imgProps.height / imgProps.width : 0.5;
    const pdfHeight = pdfWidth * aspectRatio;

    doc.addImage(base64Image, "PNG", 15, 20, pdfWidth, pdfHeight);

    // Add some space after the image
    const tableY = 20 + pdfHeight + 10;

    // Prepare table data
    const tableData = labels.map((label, i) => [label, values[i]]);

    autoTable(doc, {
        startY: tableY,
        head: [["Category", "Value"]],
        body: tableData,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [249, 128, 18] }, // UMA orange
    });

    doc.save(filename);
}
