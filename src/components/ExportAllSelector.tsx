/**
 * @file ExportAllSelector.tsx
 *
 * @description This component renders an "Export All" button along with a format selector
 * (PDF or DOCX). It allows the user to trigger a complete export of all generated charts.
 *
 * Designed to be integrated into the extension's UI, typically near the top or bottom
 * of the view. Language support is provided via `react-i18next`.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const ExportAllSelector: React.FC = () => {
    const { t } = useTranslation();
    const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        console.log(`Exporting all charts as ${format.toUpperCase()}`);
        // Simulate export logic
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsExporting(false);
    };

    return (
        <div className="flex flex-col items-center gap-2 text-xs mt-2 w-full">
            <div className="flex items-center gap-2">
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="px-2 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-medium shadow disabled:opacity-60"
                >
                    {t('export_all')}
                </button>

                <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as 'pdf' | 'docx')}
                    disabled={isExporting}
                    className="px-1.5 py-0.5 rounded border border-gray-300 shadow-sm bg-white text-gray-700 focus:outline-none disabled:opacity-60"
                >
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                </select>
            </div>

            {isExporting && (
                <div className="flex items-center justify-center mt-2">
                    <div className="relative w-6 h-6">
                        <div className="absolute inset-0 rounded-full border-2 border-t-transparent border-orange-400 animate-spin"></div>
                        <div className="absolute inset-1 rounded-full bg-orange-100 opacity-60 animate-pulse shadow-inner"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportAllSelector;
