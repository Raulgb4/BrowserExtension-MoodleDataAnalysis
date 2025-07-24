/**
 * @file StartButton.tsx
 *
 * @description This React component renders a button that initiates the analysis
 * of a Moodle course. It uses the `react-i18next` hook to provide real-time translation
 * of the button label based on the selected language.
 *
 * This component replaces the previous `createStartButton` function and ensures
 * that the label updates reactively when the user changes the language.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {useTranslation} from 'react-i18next';
import Button from './Button';
import React from 'react';

// Define the props accepted by the StartButton component
interface StartButtonProps {
    courseId: string; // ID of the course to be analyzed
    onClick: (id: string) => void; // Callback to trigger analysis
}

// Functional component that renders the start analysis button with a translated label
const StartButton: React.FC<StartButtonProps> = ({courseId, onClick}) => {
    const {t} = useTranslation(); // Access the translation function

    return (
        <Button
            id="startButton"
            text={t('start')} // Use i18n key for the button label
            onClick={() => onClick(courseId)} // Trigger the analysis callback with course ID
        />
    );
};

export default StartButton;
