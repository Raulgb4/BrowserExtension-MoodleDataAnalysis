/**
 * @file InfoCard.tsx
 * @description
 * Reusable notification component for displaying success or error messages in the Moodle Data Analyzer extension.
 * It includes automatic fade-out for non-error messages and a manual close button for quick dismissals.
 *
 * The component uses Tailwind CSS for styling and supports dynamic icons and colors based on a message type.
 * Designed to improve user feedback during actions such as data analysis or restoration.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {CheckCircleIcon, ExclamationTriangleIcon} from "@heroicons/react/24/solid";
import {XMarkIcon} from "@heroicons/react/16/solid";
import {useState, useEffect} from "react";
import { useTranslation } from 'react-i18next';

interface InfoCardProps {
    message: string;
    isError?: boolean;
}


export default function InfoCard({message, isError = false}: InfoCardProps) {
    const [visible, setVisible] = useState(true);
    const [fadingOut, setFadingOut] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        if (!isError) {
            const timer = setTimeout(() => setFadingOut(true), 3000);
            return () => clearTimeout(timer);
        }
    }, [isError]);

    useEffect(() => {
        if (fadingOut) {
            const timer = setTimeout(() => setVisible(false), 500);
            return () => clearTimeout(timer);
        }
    }, [fadingOut]);

    if (!visible) return null;

    const baseClasses =
        "mt-6 flex items-center justify-between gap-3 px-4 py-3 rounded text-sm shadow transition-opacity duration-500";
    const errorClasses = "bg-red-100 border border-red-400 text-red-700";
    const successClasses = "bg-green-100 border border-green-400 text-green-700";

    return (
        <div
            id="output"
            role="alert"
            aria-live="polite"
            className={`${baseClasses} ${isError ? errorClasses : successClasses} 
        ${fadingOut ? "opacity-0" : "opacity-100"}`}
        >
            <div className="flex items-center gap-3">
                {isError ? (
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                ) : (
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                )}
                <span className="font-medium break-words">{t(message)}</span>
            </div>

            {!isError && (
                <button onClick={() => setFadingOut(true)} aria-label="Close">
                    <XMarkIcon className="h-5 w-5 text-green-600 hover:text-green-800" />
                </button>
            )}
        </div>
    );
}
