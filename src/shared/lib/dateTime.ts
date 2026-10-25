import { format } from 'date-fns';
import { getDateFnsLocale } from './dateLocale';
import type { TimeSettings } from '@features/settings/store/settings';

/** The user's time format as a date-fns pattern, with the seconds when the user shows them */
export const timePattern = ({ timeFormat, showSeconds }: TimeSettings): string =>
  `${timeFormat === '12h' ? 'h:mm' : 'HH:mm'}${showSeconds ? ':ss' : ''}${timeFormat === '12h' ? ' a' : ''}`;

/** A date with its time in the user's format, e.g. "24 Oct 2026 22:40" */
export const formatDateTime = (date: Date, timeSettings: TimeSettings): string =>
  format(date, `d MMM yyyy ${timePattern(timeSettings)}`, { locale: getDateFnsLocale() });
