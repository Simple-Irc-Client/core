import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translateEN from '@/locales/en.json';
import translatePL from '@/locales/pl.json';

const resources = {
  en: {
    translation: translateEN,
  },
  pl: {
    translation: translatePL,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // Disable HTML escaping - React already escapes output
    },
    detection: {
      order: ['navigator', 'htmlTag'],
      caches: [],
    },
  });

export default i18n;
