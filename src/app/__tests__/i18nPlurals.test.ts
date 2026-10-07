import { describe, it, expect } from 'vitest';
import i18n from '@/app/i18n';

describe('i18n plural forms', () => {
  it.each([
    [1, '1 nieprzeczytana wiadomość'],
    [3, '3 nieprzeczytane wiadomości'],
    [5, '5 nieprzeczytanych wiadomości'],
    [22, '22 nieprzeczytane wiadomości'],
    [112, '112 nieprzeczytanych wiadomości'],
  ])('picks the Polish form for %i', (count, expected) => {
    expect(i18n.t('main.channels.unreadCount', { count, lng: 'pl' })).toBe(expected);
  });

  it.each([
    [1, '1 wzmianka'],
    [4, '4 wzmianki'],
    [11, '11 wzmianek'],
  ])('picks the Polish mention form for %i', (count, expected) => {
    expect(i18n.t('main.channels.unreadMentions', { count, lng: 'pl' })).toBe(expected);
  });

  it.each([
    [1, '1 unread away message'],
    [2, '2 unread away messages'],
  ])('picks the English form for %i', (count, expected) => {
    expect(i18n.t('main.toolbar.awayMessageCount', { count, lng: 'en' })).toBe(expected);
  });
});
