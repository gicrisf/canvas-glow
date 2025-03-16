import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json'; // Import your locale files
import it from './locales/it.json';
import es from './locales/es.json';

i18n
  .use(initReactI18next) // Passes i18n down to react-i18next
  .init({
    resources: {
      en: { translation: en }, // English translations
      it: { translation: it }, // French translations
      es: { translation: es }, // Spanish translations
    },
    lng: 'en', // Default language
    fallbackLng: 'en', // Fallback language if translation is missing
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
