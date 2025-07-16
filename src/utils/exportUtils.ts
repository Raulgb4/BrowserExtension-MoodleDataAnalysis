/**
 * @file exportUtils.ts
 * @description
 * This utility module provides functions to export chart data and visualizations
 * in various formats including CSV, image (PNG or JPEG), and PDF.
 * It leverages Chart.js for accessing chart instances, and jsPDF with jsPDF-AutoTable
 to generate structured documents containing both charts and associated data.
 *
 * These exports are intended to enhance the usability and shareability of
 * statistical information extracted from Moodle activities or other data sources.
 * @author Raúl García Balongo
 * @date 2025
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {Chart as ChartJS} from "chart.js";
import React, {RefObject} from "react";

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
    const title = filename.replace(/\.[^/.]+$/, ""); // sin .csv
    const header = ["Category", "Value"];
    const rows = labels.map((label, i) => [label, values[i]]);

    const csv = [
        [title],          // primera fila: título
        header,           // segunda fila: cabecera
        ...rows           // datos
    ]
        .map((row) => row.join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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
 * It uses 'Chart.js' built-in `toBase64Image()` method to generate
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
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    const exportCanvas = document.createElement("canvas");
    const ctx = exportCanvas.getContext("2d");

    if (!ctx) {
        console.warn("Unable to get canvas context for export.");
        return;
    }

    // Configurar estilos de fuente
    ctx.font = "bold 16px sans-serif";
    const maxTextWidth = originalWidth - 40;

    // Función para dividir el título largo en varias líneas
    const wrapText = (text: string, maxWidth: number): string[] => {
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }

        lines.push(currentLine);
        return lines;
    };

    const titleLines = wrapText(filename, maxTextWidth);
    const titleHeight = titleLines.length * 22 + 10; // espacio vertical por línea
    exportCanvas.width = originalWidth;
    exportCanvas.height = originalHeight + titleHeight;

    // Reasignar el contexto (algunas versiones pierden el contexto después de cambiar altura)
    const finalCtx = exportCanvas.getContext("2d");
    if (!finalCtx) {
        console.warn("Unable to get final canvas context.");
        return;
    }

    finalCtx.fillStyle = "white";
    finalCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    finalCtx.fillStyle = "black";
    finalCtx.font = "bold 16px sans-serif";
    finalCtx.textAlign = "center";

    titleLines.forEach((line, i) => {
        finalCtx.fillText(line, exportCanvas.width / 2, 25 + i * 22);
    });

    finalCtx.drawImage(canvas, 0, titleHeight);

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
 * and `jspdf-auto table` to render the data in tabular form.
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

    const title = filename.replace(/\.[^/.]+$/, "");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(title, pageWidth / 2, 15, {align: "center"});

    const imgProps = (doc as any).getImageProperties?.(base64Image);
    const pdfWidth = 180;
    const aspectRatio = imgProps ? imgProps.height / imgProps.width : 0.5;
    const pdfHeight = pdfWidth * aspectRatio;

    doc.addImage(base64Image, "PNG", 15, 25, pdfWidth, pdfHeight);

    const tableY = 25 + pdfHeight + 10;
    const tableData = labels.map((label, i) => [label, values[i]]);

    autoTable(doc, {
        startY: tableY,
        head: [["Category", "Value"]],
        body: tableData,
        styles: {fontSize: 10},
        headStyles: {fillColor: [249, 128, 18]},
    });

    doc.save(filename);
}
