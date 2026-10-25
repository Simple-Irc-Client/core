import { describe, it, expect } from 'vitest';
import i18n from '@/app/i18n';
import { languages } from '@/config/languages';
import { getDateFnsLocale } from '../dateLocale';

const dateLocaleIn = async (language: string): Promise<string | undefined> => {
  await i18n.changeLanguage(language);
  return getDateFnsLocale().code;
};

describe('getDateFnsLocale', () => {
  it.each(languages.filter(({ code }) => code !== 'en'))('writes dates in $label when the app is in $label', async ({ code }) => {
    expect(await dateLocaleIn(code)).toBe(code);
  });

  it('writes English dates in American English', async () => {
    expect(await dateLocaleIn('en')).toBe('en-US');
  });

  it('writes dates in the language of a regional tag', async () => {
    expect(await dateLocaleIn('pl-PL')).toBe('pl');
    expect(await dateLocaleIn('fr-FR')).toBe('fr');
  });

  it('writes Portuguese from Portugal in Brazilian Portuguese, like its texts', async () => {
    expect(await dateLocaleIn('pt-PT')).toBe('pt-BR');
  });

  it('writes dates in English for a language the app has no translation for', async () => {
    expect(await dateLocaleIn('ja')).toBe('en-US');
  });
});
