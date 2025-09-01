/**
 * @file Loader.tsx
 * @description
 * Displays a visual loading spinner with a message indicating that an analysis is in progress.
 * Used in the Moodle Data Analyzer popup while data is being scraped and processed.
 *
 * The component consists of a rotating border circle and a caption below it.
 * Styled using Tailwind CSS for consistent layout and animation.
 *
 * @component
 * @returns JSX.Element A centered loading indicator with animation and descriptive text.
 *
 * @example
 * <Loader />
 */

import {useTranslation} from "react-i18next";
import {useAnalysisContext} from "../context/AnalysisProgressContext";

export default function Loader() {
    const {t} = useTranslation();
    const {progress} = useAnalysisContext();

    const labelKey = progress.label || "status.analyzing";
    const label = t(labelKey);

    const percent = Number.isFinite(progress.percent)
        ? Math.max(0, Math.min(100, Math.round(progress.percent)))
        : 0;
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 h-full animate-fade-in"
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            <div className="relative w-14 h-14">
                {/* Spinner ring */}
                <div
                    className="absolute inset-0 rounded-full
                    border-4 border-t-transparent border-orange-400 animate-spin"></div>
                {/* Inner glow */}
                <div className="absolute inset-1.5 rounded-full bg-orange-100 opacity-60 shadow-inner"></div>
                {/* Percent in a center */}
                <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-orange-700 tabular-nums">
            {percent}%
          </span>
                </div>
            </div>

            {/* Label + step/total */}
            <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-semibold text-orange-600 tracking-wide">
          {label}
        </span>
            </div>
        </div>
    );
}
