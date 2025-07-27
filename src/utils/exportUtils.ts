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
import {
    AlignmentType,
    Document,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType
} from "docx";
import {saveAs} from "file-saver";
import type {Exportable} from "../context/ExportContext";


/**
 * @function formatDateForExport
 * @description
 * Formats a JavaScript Date object into a string suitable for use in filenames.
 * The format is `YYYY-MM-DD_HH-MM` to ensure compatibility across file systems.
 *
 * @param {Date} date - The Date object to format.
 * @returns {string} A formatted string representing the date and time.
 */
export const formatDateForExport = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}_${h}-${min}`;
};

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
 * @param headers
 * @returns {void} This function does not return anything; it triggers a download.
 */
export function exportToCSV(
    labels: string[],
    values: number[],
    filename: string = "export.csv",
    headers: [string, string] = ["Category", "Value"]
): void {
    const title = filename.replace(/\.[^/.]+$/, "");
    const header = headers;
    const rows = labels.map((label, i) => [label, values[i]]);

    const csv = [
        [title],
        header,
        ...rows
    ]
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
 * It uses 'Chart.js' built-in `toBase64Image()` method to generate
 * a base64-encoded image and triggers a download in the browser.
 *
 * @param {React.RefObject<ChartJS | null>} chartRef - Ref to the rendered chart instance.
 * @param {"png" | "jpeg"} format - Desired image format ("png" or "jpeg").
 * @param [filename="chart"] - Base filename without extension.
 *
 * @returns {void}
 */
export function exportToImage(
    chartRef: React.RefObject<ChartJS | null>,
    format: "png" | "jpeg",
    filename = "chart"
): void {
    const chart = chartRef.current;
    if (!chart) {
        console.warn(`Chart reference is not available for ${format.toUpperCase()} export.`);
        return;
    }

    const sourceCanvas = chart.canvas as HTMLCanvasElement;
    const {width: originalWidth, height: originalHeight} = sourceCanvas;

    const exportCanvas = document.createElement("canvas");
    const ctx = exportCanvas.getContext("2d");

    if (!ctx) {
        console.warn("Unable to get canvas context for export.");
        return;
    }

    // Title wrapping
    ctx.font = "bold 16px sans-serif";
    const maxTextWidth = originalWidth - 40;

    const wrapText = (text: string, maxWidth: number): string[] => {
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = words[0] ?? "";

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + " " + word;
            if (ctx.measureText(testLine).width < maxWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }

        lines.push(currentLine);
        return lines;
    };

    const titleLines = wrapText(filename, maxTextWidth);
    const titleHeight = titleLines.length * 22 + 10;

    exportCanvas.width = originalWidth;
    exportCanvas.height = originalHeight + titleHeight;

    const finalCtx = exportCanvas.getContext("2d");
    if (!finalCtx) {
        console.warn("Unable to get final canvas context.");
        return;
    }

    // Background
    finalCtx.fillStyle = "white";
    finalCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Title
    finalCtx.fillStyle = "black";
    finalCtx.font = "bold 16px sans-serif";
    finalCtx.textAlign = "center";

    titleLines.forEach((line, i) => {
        finalCtx.fillText(line, exportCanvas.width / 2, 25 + i * 22);
    });

    // Chart
    finalCtx.drawImage(sourceCanvas, 0, titleHeight);

    // Export
    const mimeType = `image/${format}`;
    const imageDataUrl = exportCanvas.toDataURL(mimeType);

    const link = document.createElement("a");
    link.href = imageDataUrl;
    link.download = `${filename}.${format}`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Exports a Chart.js chart as a PDF file with its image and a data table.
 *
 * Uses `ChartJS.toBase64Image()` to embed the chart and `jspdf-auto table` for tabular data.
 *
 * @param chartRef - Reference to the Chart.js instance.
 * @param labels - The labels corresponding to chart data categories.
 * @param values - The values associated with each label.
 * @param filename - Desired filename for the exported PDF (default: "chart.pdf").
 * @param headers
 */
export function exportToPDF(
    chartRef: RefObject<ChartJS | null>,
    labels: string[],
    values: number[],
    filename = "chart.pdf",
    headers: [string, string] = ["Category", "Value"]
): void {
    const chart = chartRef.current;
    if (!chart) {
        console.warn("Chart reference is not available for PDF export.");
        return;
    }

    const base64Image = chart.toBase64Image();
    const doc = new jsPDF();
    const title = filename.replace(/\.[^/.]+$/, ""); // Remove extension

    // Title
    doc.setFontSize(12); // Tailwind text-sm
    doc.setFont("helvetica", "bold");
    doc.setTextColor(249, 128, 18); // text-orange-600 (#f98012)
    doc.setDrawColor(249, 128, 18); // Border color similar
    doc.setFillColor(255, 247, 237); // bg-orange-100 (#fff7ed)
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.roundedRect(15, 10, pageWidth - 30, 12, 2, 2, 'F'); // background box
    doc.text(title, pageWidth / 2, 18, {align: "center"}); // centered text


    // Chart image
    const imgProps = (doc as any).getImageProperties?.(base64Image);
    const pdfWidth = 180;
    const aspectRatio = imgProps ? imgProps.height / imgProps.width : 0.5;
    const pdfHeight = pdfWidth * aspectRatio;

    doc.addImage(base64Image, "PNG", 15, 25, pdfWidth, pdfHeight);

    // Table
    const tableStartY = 25 + pdfHeight + 10;
    const tableData = labels.map((label, i) => [label, values[i]]);

    autoTable(doc, {
        startY: tableStartY,
        head: [headers],
        body: tableData,
        styles: {fontSize: 10},
        headStyles: {fillColor: [249, 128, 18]},
    });

    doc.save(filename);
}


/**
 * Exports a Chart.js chart as a DOCX file with its image and corresponding data table.
 *
 * The function captures the chart using `ChartJS.toBase64Image()`, converts the image to a byte array,
 * and embeds it into a Microsoft Word document using `docx`. It also creates a styled table containing
 * the chart's data (labels and values), with alternating row shading and a colored header.
 *
 * This export format provides a more editable and presentation-friendly alternative to PDF.
 *
 * @param chartRef - Reference to the Chart.js instance to be exported.
 * @param labels - Array of labels corresponding to chart data categories.
 * @param values - Array of values associated with each label.
 * @param filename - Desired filename for the exported DOCX (default: "chart.docx").
 * @param headers - Tuple specifying the column headers for the table (default: ["Category", "Value"]).
 *
 * @returns A Promise that resolves when the file has been generated and saved.
 */
export async function exportToDOCX(
    chartRef: RefObject<ChartJS | null>,
    labels: string[],
    values: number[],
    filename = "chart.docx",
    headers: [string, string] = ["Category", "Value"]
): Promise<void> {
    const chart = chartRef.current;
    if (!chart) {
        console.warn("Chart reference is not available for DOCX export.");
        return;
    }

    // Convert chart image to byte array
    const imageBase64 = chart.toBase64Image();
    const byteString = atob(imageBase64.split(",")[1]);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }

    // Title block (more space, centered inside the box)
    const title = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
            before: 200,
            after: 300,
            line: 360,
        },
        shading: {
            fill: "fff7ed",
        },
        children: [
            new TextRun({text: "\n"}), // simulate top padding
            new TextRun({
                text: filename.replace(/\.[^/.]+$/, ""),
                bold: true,
                size: 22, // reduced font size
                font: "Helvetica",
                color: "f98012",
            }),
            new TextRun({text: "\n"}), // simulate bottom padding
        ],
    });

    // Chart image
    const image = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {after: 300},
        children: [
            new ImageRun({
                data: byteArray,
                transformation: {
                    width: 480,
                    height: 270,
                },
                type: "png",
            }),
        ],
    });

    // Table header row (left aligned)
    const tableHeaderRow = new TableRow({
        tableHeader: true,
        children: headers.map(header =>
            new TableCell({
                width: {size: 50, type: WidthType.PERCENTAGE},
                shading: {fill: "f98012"},
                children: [
                    new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: [
                            new TextRun({
                                text: header,
                                bold: true,
                                color: "ffffff",
                                font: "Helvetica",
                            }),
                        ],
                    }),
                ],
            })
        ),
    });

    // Table data rows (left aligned, alternating shading)
    const dataRows = labels.map((label, i) =>
        new TableRow({
            children: [
                new TableCell({
                    shading: i % 2 === 0 ? {fill: "f9fafb"} : undefined,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            children: [
                                new TextRun({
                                    text: label,
                                    font: "Helvetica",
                                }),
                            ],
                        }),
                    ],
                }),
                new TableCell({
                    shading: i % 2 === 0 ? {fill: "f9fafb"} : undefined,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            children: [
                                new TextRun({
                                    text: values[i].toString(),
                                    font: "Helvetica",
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        })
    );

    const table = new Table({
        rows: [tableHeaderRow, ...dataRows],
        width: {size: 100, type: WidthType.PERCENTAGE},
        alignment: AlignmentType.CENTER,
    });

    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [title, image, table],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
}

/**
 * Generates a comprehensive PDF report containing all registered Chart.js graphs.
 *
 * This function dynamically fetches the course name from Chrome storage to create a
 * customized cover page. It then iterates through all exportable charts registered via
 * context and renders each chart along with its translated title and associated data table.
 *
 * Internally uses `ChartJS.toBase64Image()` to capture each chart as an image,
 * and `jspdf-autotable` to render a structured table of corresponding labels and values.
 *
 * @param exportables - Array of chart export objects, each containing a Chart reference,
 *                      a title (used as the section header), and associated labels and values.
 * @param t - Translation function provided by `useTranslation` to support multilingual titles and headers.
 *
 * @returns A Promise that resolves once the full PDF document has been created and downloaded.
 */
export async function exportAllToPDF(
    exportables: Exportable[],
    t: (key: string) => string // Pass translation function from useTranslation
) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const now = new Date();
    const formattedDate = formatDateForExport(now);

    // === Load course name dynamically from storage ===
    const courseName: string = await new Promise((resolve) => {
        chrome.storage.local.get(["lastAnalyzedCourseId"], (res) => {
            const courseId = res.lastAnalyzedCourseId;
            if (!courseId) return resolve(t("course.unknown"));

            chrome.storage.local.get([`course_${courseId}`], (data) => {
                const course = data[`course_${courseId}`];
                const name = course?.courseName || t("course.unnamed");
                resolve(name);
            });
        });
    });

    const author = "Raúl García Balongo";

    // ===== 1. Cover page =====
    doc.setFillColor(255, 247, 237); // Light orange background
    doc.rect(0, 0, pageWidth, pageHeight, 'F'); // Full-page background

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(249, 128, 18);

    const titleLines = doc.splitTextToSize(courseName, pageWidth - 40);
    const titleStartY = 60;
    const lineHeight = 8;
    const titleBlockHeight = titleLines.length * lineHeight;

    doc.text(titleLines, pageWidth / 2, titleStartY, {align: "center"});

    const nextBlockY = titleStartY + titleBlockHeight + 10;

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${t("pdf.analysis_date")}: ${formattedDate}`, pageWidth / 2, nextBlockY, {align: "center"});
    doc.text(`${t("pdf.author")}: ${author}`, pageWidth / 2, nextBlockY + 10, {align: "center"});

    const logoY = nextBlockY + 25;
    const logo = new Image();
    logo.src = "/icons/icon128.png";

    await new Promise<void>((resolve) => {
        logo.onload = () => {
            doc.addImage(logo, "PNG", pageWidth / 2 - 32, logoY, 64, 64);
            resolve();
        };
    });

    doc.addPage();

    // ===== 2. Charts =====
    for (let i = 0; i < exportables.length; i++) {
        const {chartRef, title, labels, values} = exportables[i];
        const chart = chartRef.current;
        if (!chart) continue;

        const base64Image = chart.toBase64Image();
        const imgProps = (doc as any).getImageProperties?.(base64Image);
        const pdfWidth = 180;
        const aspectRatio = imgProps ? imgProps.height / imgProps.width : 0.5;
        const pdfHeight = pdfWidth * aspectRatio;

        const translatedTitle = t(title); // Translate chart title

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(249, 128, 18);
        doc.setDrawColor(249, 128, 18);
        doc.setFillColor(255, 247, 237);
        doc.roundedRect(15, 10, pageWidth - 30, 12, 2, 2, 'F');
        doc.text(translatedTitle, pageWidth / 2, 18, {align: "center"});

        doc.addImage(base64Image, "PNG", 15, 25, pdfWidth, pdfHeight);

        const tableStartY = 25 + pdfHeight + 10;
        const tableData = labels.map((label, i) => [label, values[i]]);
        autoTable(doc, {
            startY: tableStartY,
            head: [[t("category"), t("value")]],
            body: tableData,
            styles: {fontSize: 10},
            headStyles: {fillColor: [249, 128, 18]},
        });

        if (i < exportables.length - 1) doc.addPage();
    }

    const filename = `Moodle_Report_${formattedDate}.pdf`;
    doc.save(filename);
}



