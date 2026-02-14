import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { languages } from '@/config/languages';

const localeModules = import.meta.glob('../locales/*.json', { eager: true }) as Record<string, { default: Record<string, unknown> }>;

const resources = Object.fromEntries(
  languages.map(({ code }) => [
    code,
    { translation: localeModules[`../locales/${code}.json`]?.default ?? {} },
  ]),
);

const validCodes = new Set(languages.map(({ code }) => code));

// Read persisted language from localStorage (zustand persist key)
const getPersistedLanguage = (): string | undefined => {
  try {
    const raw = localStorage.getItem('sic-settings');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const language = parsed?.state?.language;
    if (language && language !== 'auto' && validCodes.has(language)) return language;
  } catch {
    // ignore parse errors
  }
  return undefined;
};

const persistedLanguage = getPersistedLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    ...(persistedLanguage ? { lng: persistedLanguage } : {}),
    interpolation: {
      escapeValue: false, // Disable HTML escaping - React already escapes output
    },
    detection: {
      order: ['navigator', 'htmlTag'],
      caches: [],
    },
  });

export default i18n;
