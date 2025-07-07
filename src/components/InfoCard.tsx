/**
 * @file InfoCard.tsx
 * @description
 * Displays a styled message box within the popup interface of the Moodle Data Analyzer extension.
 * This component is used to show feedback to the user, such as success or error messages, after
 * performing scraping or analysis operations.
 *
 * The text color adapts based on the `isError` flag: red for error messages and green for success/info.
 *
 * @component
 * @param {string} message - The text message to display inside the card.
 * @param {boolean} [isError=false] - Whether the message represents an error (default is `false`).
 *
 * @returns {JSX.Element} A styled message container with conditional coloring.
 *
 * @example
 * <InfoCard message="Analysis complete." />
 * <InfoCard message="Failed to fetch participants." isError />
 */
import React from "react";

type InfoCardProps = {
    message: string;
    isError?: boolean;
};

export default function InfoCard({ message, isError = false }: InfoCardProps) {
    return (
        <div
            id="output"
            className={`mt-6 text-base whitespace-pre-wrap font-medium ${
                isError ? 'text-red-500' : 'text-green-600'
            }`}
        >
            {message}
        </div>
    );
}
