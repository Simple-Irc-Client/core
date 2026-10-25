import { describe, it, expect } from 'vitest';
import i18n from '@/app/i18n';
import { languages } from '@/config/languages';

const localeFiles = import.meta.glob<Record<string, string>>('../../locales/*.json', { eager: true, import: 'default' });
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

const readLocale = (code: string): Record<string, string> => localeFiles[`../../locales/${code}.json`] ?? {};

const baseKey = (key: string): string => key.replace(PLURAL_SUFFIX, '');
const baseKeys = (locale: Record<string, string>): string[] => [...new Set(Object.keys(locale).map(baseKey))].sort();
const variables = (text: string): string[] => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1] ?? '').sort();

const english = readLocale('en');
const translations = languages.filter(({ code }) => code !== 'en').map(({ code }) => [code, readLocale(code)] as const);

describe('locales', () => {
  it('has a language for every locale file, and a file for every language', () => {
    const files = Object.keys(localeFiles).map((path) => /([^/]+)\.json$/.exec(path)?.[1]).sort();

    expect(files).toEqual(languages.map(({ code }) => code).sort());
  });

  it.each(translations)('%s has every text English has, and nothing more', (_code, locale) => {
    expect(baseKeys(locale)).toEqual(baseKeys(english));
  });

  it.each(translations)('%s fills in the same variables as English', (_code, locale) => {
    for (const [key, text] of Object.entries(locale)) {
      // A plural form is checked against the English plural (`_other`), which names every variable
      const englishText = english[key] ?? english[`${baseKey(key)}_other`] ?? '';
      expect(variables(text), key).toEqual(variables(englishText));
    }
  });

  it.each(translations)('%s has every plural form its language uses', (code, locale) => {
    const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    const plurals = [...new Set(Object.keys(english).filter((key) => PLURAL_SUFFIX.test(key)).map(baseKey))];

    for (const key of plurals) {
      for (const category of categories) {
        expect(locale, `${key}_${category}`).toHaveProperty([`${key}_${category}`]);
      }
    }
  });

  it('shows Portuguese from Portugal in Brazilian Portuguese rather than English', () => {
    expect(i18n.t('main.chat.reply', { lng: 'pt-PT' })).toBe(readLocale('pt-BR')['main.chat.reply']);
  });
});
