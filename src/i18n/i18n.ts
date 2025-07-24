/**
 * @file i18n.ts
 * @description
 * Initializes and configures internationalization (i18n) for the React extension using i18next.
 * This setup supports English and Spanish, with automatic detection based on the user's browser language.
 * The configuration uses `react-i18next` to enable translation features in React components.
 *
 * Language resources are loaded from static JSON files located in `locales/en` and `locales/es`.
 *
 * @date 2025
 */
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';

import en from './locales/en/translation.json';
import es from './locales/es/translation.json';

i18n
    .use(initReactI18next) // Connects i18next with React
    .init({
        resources: {
            en: {translation: en},
            es: {translation: es},
        },
        // Set initial language based on browser language
        lng: navigator.language.startsWith('es') ? 'es' : 'en',
        fallbackLng: 'en', // Fallback to English if a translation is missing
        interpolation: {
            escapeValue: false, // Not needed for React; prevents double escaping
        },
    })
    .then(() => {
        console.log('i18n initialized successfully');
    });

export default i18n;
