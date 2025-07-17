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
export default function Loader() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 h-full animate-fade-in">
            <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-orange-400
                animate-spin"></div>
                <div className="absolute inset-1.5 rounded-full bg-orange-100 opacity-60 animate-pulse
                shadow-inner"></div>
            </div>

            <span className="text-sm font-semibold text-orange-600 animate-pulse-slow tracking-wide">
                Analyzing Moodle data...
            </span>
        </div>
    );
}