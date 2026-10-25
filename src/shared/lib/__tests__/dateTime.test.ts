import { describe, expect, it, vi } from 'vitest';
import { formatDateTime, timePattern } from '../dateTime';

vi.mock('@/shared/lib/dateLocale', async () => {
  const { enUS } = await import('date-fns/locale');
  return { getDateFnsLocale: () => enUS };
});

// Local time, so the expectations don't depend on the machine's time zone
const AFTERNOON = new Date(2026, 9, 24, 22, 40, 9);

describe('timePattern', () => {
  it.each([
    ['24h', false, 'HH:mm'],
    ['24h', true, 'HH:mm:ss'],
    ['12h', false, 'h:mm a'],
    ['12h', true, 'h:mm:ss a'],
  ] as const)('should give %s with seconds %s as %s', (timeFormat, showSeconds, pattern) => {
    expect(timePattern({ timeFormat, showSeconds })).toBe(pattern);
  });
});

describe('formatDateTime', () => {
  it.each([
    ['24h', false, '24 Oct 2026 22:40'],
    ['24h', true, '24 Oct 2026 22:40:09'],
    ['12h', false, '24 Oct 2026 10:40 PM'],
    ['12h', true, '24 Oct 2026 10:40:09 PM'],
  ] as const)('should show %s with seconds %s as %s', (timeFormat, showSeconds, shown) => {
    expect(formatDateTime(AFTERNOON, { timeFormat, showSeconds })).toBe(shown);
  });
});
