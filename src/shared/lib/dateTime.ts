import { format } from 'date-fns';
import { getDateFnsLocale } from './dateLocale';
import type { TimeFormat } from '@features/settings/store/settings';

/** The user's time format as a date-fns pattern, with the seconds when the user shows them */
export const timePattern = (timeFormat: TimeFormat, showSeconds: boolean): string =>
  `${timeFormat === '12h' ? 'h:mm' : 'HH:mm'}${showSeconds ? ':ss' : ''}${timeFormat === '12h' ? ' a' : ''}`;

/** A date with its time in the user's format, e.g. "24 Oct 2026 22:40" */
export const formatDateTime = (date: Date, timeFormat: TimeFormat, showSeconds: boolean): string =>
  format(date, `d MMM yyyy ${timePattern(timeFormat, showSeconds)}`, { locale: getDateFnsLocale() });
