import { describe, it, expect, vi } from 'vitest';
import { enUS, pl } from 'date-fns/locale';

vi.mock('@/app/i18n', () => ({
  default: { language: 'en' },
}));

import i18n from '@/app/i18n';
import { getDateFnsLocale } from '../dateLocale';

describe('getDateFnsLocale', () => {
  it('returns enUS for "en"', () => {
    i18n.language = 'en';
    expect(getDateFnsLocale()).toBe(enUS);
  });

  it('returns pl for "pl"', () => {
    i18n.language = 'pl';
    expect(getDateFnsLocale()).toBe(pl);
  });

  it('returns pl for BCP 47 tag "pl-PL"', () => {
    i18n.language = 'pl-PL';
    expect(getDateFnsLocale()).toBe(pl);
  });

  it('returns enUS for BCP 47 tag "en-US"', () => {
    i18n.language = 'en-US';
    expect(getDateFnsLocale()).toBe(enUS);
  });

  it('returns enUS for BCP 47 tag "en-GB"', () => {
    i18n.language = 'en-GB';
    expect(getDateFnsLocale()).toBe(enUS);
  });

  it('falls back to enUS for unknown language', () => {
    i18n.language = 'de';
    expect(getDateFnsLocale()).toBe(enUS);
  });

  it('falls back to enUS for unknown BCP 47 tag', () => {
    i18n.language = 'fr-FR';
    expect(getDateFnsLocale()).toBe(enUS);
  });

  it('falls back to enUS when language is undefined', () => {
    i18n.language = undefined as unknown as string;
    expect(getDateFnsLocale()).toBe(enUS);
  });
});
