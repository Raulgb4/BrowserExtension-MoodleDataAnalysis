/**
 * @file RestartButton.tsx
 *
 * @description This React component renders a button that allows the user to reanalyze
 * the current Moodle course data. It uses the `react-i18next` hook to provide
 * dynamic translation of the button label based on the selected language.
 *
 * This component replaces the old `createRestartButton` function to ensure that
 * translations update reactively when the language changes.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {useTranslation} from 'react-i18next';
import Button from './Button';
import React from "react";

// Define the props expected by the RestartButton component
interface RestartButtonProps {
    courseId: string; // ID of the course to be reanalyzed
    onClick: (id: string) => void; // Callback executed when the button is clicked
}

// Functional component that renders the reanalyzed button with translated text
const RestartButton: React.FC<RestartButtonProps> = ({courseId, onClick}) => {
    const {t} = useTranslation(); // Access translation function

    return (
        <Button
            id="restartButton"
            text={t('reanalyze')} // Use i18n key for reanalyze label
            onClick={() => onClick(courseId)} // Trigger callback with course ID
        />
    );
};

export default RestartButton;
