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
        <div className="flex flex-col items-center justify-center h-full">
            <div
                className="w-12 h-12 border-[5px] border-orange-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-orange-500 font-medium mt-2">Loading analysis...</span>
        </div>
    );
}