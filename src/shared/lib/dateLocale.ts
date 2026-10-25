import i18n from '@/app/i18n';
import { bg, de, enUS, es, fr, id, it, lt, ms, nl, pl, ptBR, ro, tr } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { LanguageCode } from '@/config/languages';

const localeMap: Record<LanguageCode, Locale> = {
  en: enUS,
  bg,
  de,
  es,
  fr,
  id,
  it,
  lt,
  ms,
  nl,
  pl,
  'pt-BR': ptBR,
  ro,
  tr,
};

const isLanguageCode = (language: string): language is LanguageCode => Object.hasOwn(localeMap, language);

/** Dates follow the translation actually shown, so pt-PT reads Brazilian dates like its texts */
export const getDateFnsLocale = (): Locale => {
  const language = i18n.resolvedLanguage;
  return language && isLanguageCode(language) ? localeMap[language] : enUS;
};
