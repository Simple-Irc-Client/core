import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import MessageTime, { timePattern, timeWidthCh } from '../MessageTime';
import { useSettingsStore } from '@features/settings/store/settings';

// Local time, so the expectations don't depend on the machine's time zone
const AFTERNOON = new Date(2024, 0, 1, 14, 5, 9);
const MORNING = new Date(2024, 0, 1, 9, 5, 9);

const renderTime = (time: Date) => render(<span data-testid="time"><MessageTime time={time} /></span>).getByTestId('time');

describe('MessageTime', () => {
  beforeEach(() => {
    useSettingsStore.setState({ timeFormat: '24h', showSeconds: false, language: 'en' });
  });

  it('shows 24-hour time, with the seconds apart for themes to hide', () => {
    const time = renderTime(AFTERNOON);

    expect(time).toHaveTextContent(/^14:05:09$/);
    expect(time.querySelector('.sic-msg-time-seconds')).toHaveTextContent(/^:09$/);
  });

  it('shows the seconds as part of the time when the user wants them', () => {
    useSettingsStore.setState({ showSeconds: true });

    const time = renderTime(AFTERNOON);

    expect(time).toHaveTextContent(/^14:05:09$/);
    expect(time.querySelector('.sic-msg-time-seconds')).not.toBeInTheDocument();
  });

  it('shows 12-hour time with AM or PM after the seconds', () => {
    useSettingsStore.setState({ timeFormat: '12h' });

    expect(renderTime(AFTERNOON)).toHaveTextContent(/^2:05:09 PM$/);
  });

  it('shows 12-hour morning time with the seconds', () => {
    useSettingsStore.setState({ timeFormat: '12h', showSeconds: true });

    const time = renderTime(MORNING);

    expect(time).toHaveTextContent(/^9:05:09 AM$/);
    expect(time.querySelector('.sic-msg-time-seconds')).not.toBeInTheDocument();
  });

  it('sizes the time column for the widest time in the format', () => {
    expect(timeWidthCh('24h', false)).toBe(5);
    expect(timeWidthCh('24h', true)).toBe(8);
    expect(timeWidthCh('12h', false)).toBe(8);
    expect(timeWidthCh('12h', true)).toBe(11);
  });
});

describe('timePattern', () => {
  it.each([
    ['24h', false, 'HH:mm'],
    ['24h', true, 'HH:mm:ss'],
    ['12h', false, 'h:mm a'],
    ['12h', true, 'h:mm:ss a'],
  ] as const)('should give %s with seconds %s as %s', (timeFormat, showSeconds, pattern) => {
    expect(timePattern(timeFormat, showSeconds)).toBe(pattern);
  });
});
