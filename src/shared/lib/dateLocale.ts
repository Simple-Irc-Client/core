import i18n from '@/app/i18n';
import { enUS, pl } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const localeMap: Record<string, Locale> = {
  en: enUS,
  pl: pl,
};

export const getDateFnsLocale = (): Locale => {
  const lang = i18n.language?.split('-')[0] ?? 'en';
  return localeMap[lang] ?? enUS;
};
