/**
 * @file LanguageSelector.tsx
 *
 * @description This React component renders a language selector using a <select> dropdown,
 * allowing the user to switch between English and Spanish (EN 🇬🇧 / ES 🇪🇸).
 *
 * It uses the `react-i18next` hook to access the i18n instance and update the
 * current language dynamically at runtime. This enables real-time interface translation
 * without reloading the extension.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {useTranslation} from 'react-i18next';
import React from "react";

const LanguageSelector: React.FC = () => {
    const {i18n} = useTranslation();

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedLang = event.target.value as 'en' | 'es';
        i18n.changeLanguage(selectedLang).then(() => {
            console.log(`Language changed to ${selectedLang}`);
        });
    };

    const flagSrc = i18n.language === 'es'
        ? '/icons/flags/es.png'
        : '/icons/flags/gb.png';

    return (
        <div className="flex items-center gap-2 text-sm">
            <img
                src={flagSrc}
                alt="Language flag"
                className="w-5 h-3.5 object-cover rounded-sm shadow-sm"
            />
            <select
                onChange={handleChange}
                value={i18n.language}
                className="text-xs px-2 py-1 rounded-md border border-gray-300 shadow-sm bg-white text-gray-700 focus:outline-none"
            >
                <option value="en">EN</option>
                <option value="es">ES</option>
            </select>
        </div>
    );
};

export default LanguageSelector;
