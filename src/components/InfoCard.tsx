/**
 * @file InfoCard.tsx
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {CheckCircleIcon, ExclamationTriangleIcon} from "@heroicons/react/24/solid";
import {XMarkIcon} from "@heroicons/react/16/solid";
import {useState} from "react";

interface InfoCardProps {
    message: string;
    isError?: boolean;
}


export default function InfoCard({message, isError = false}: InfoCardProps) {
    const [visible, setVisible] = useState(true);

    if (!visible) return null;

    const baseClasses =
        "mt-6 flex items-center justify-between gap-3 px-4 py-3 rounded text-sm shadow";
    const errorClasses =
        "bg-red-100 border border-red-400 text-red-700";
    const successClasses =
        "bg-green-100 border border-green-400 text-green-700";

    return (
        <div
            id="output"
            role="alert"
            className={`${baseClasses} ${isError ? errorClasses : successClasses}`}
        >
            <div className="flex items-center gap-3">
                {isError ? (
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-500"/>
                ) : (
                    <CheckCircleIcon className="h-6 w-6 text-green-500"/>
                )}
                <span className="whitespace-nowrap font-medium">{message}</span>
            </div>

            {!isError && (
                <button onClick={() => setVisible(false)} aria-label="Close">
                    <XMarkIcon className="h-5 w-5 text-green-600 hover:text-green-800"/>
                </button>
            )}
        </div>
    );
}
