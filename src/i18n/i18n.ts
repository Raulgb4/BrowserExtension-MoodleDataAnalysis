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

function getInitialLanguage(): Promise<'en' | 'es'> {
    return new Promise((resolve) => {
        chrome.storage?.local.get("preferredLanguage", ({ preferredLanguage }) => {
            if (preferredLanguage === 'en' || preferredLanguage === 'es') {
                resolve(preferredLanguage);
            } else {
                resolve(navigator.language.startsWith('es') ? 'es' : 'en');
            }
        });
    });
}

getInitialLanguage().then((initialLang) => {
    i18n
        .use(initReactI18next)
        .init({
            resources: {
                en: { translation: en },
                es: { translation: es },
            },
            lng: initialLang,
            fallbackLng: 'en',
            interpolation: {
                escapeValue: false,
            },
        })
        .then(() => {
            console.log(`i18n initialized with language: ${initialLang}`);
        });
});

export default i18n;
