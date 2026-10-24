import { format } from 'date-fns';
import { getDateFnsLocale } from '@/shared/lib/dateLocale';
import { useSettingsStore, type TimeFormat } from '@features/settings/store/settings';

/** The widest time in a format, in digits: what themes size the time column by */
export const timeWidthCh = (timeFormat: TimeFormat, showSeconds: boolean): number =>
  5 + (showSeconds ? 3 : 0) + (timeFormat === '12h' ? 3 : 0);

/** The time in the user's format as a date-fns pattern, with the seconds when the user shows them */
export const timePattern = (timeFormat: TimeFormat, showSeconds: boolean): string =>
  `${timeFormat === '12h' ? 'h:mm' : 'HH:mm'}${showSeconds ? ':ss' : ''}${timeFormat === '12h' ? ' a' : ''}`;

/** The time in the user's format; the seconds a theme may hide go in .sic-msg-time-seconds unless the user shows them */
const MessageTime = ({ time }: { time: Date }) => {
  const timeFormat = useSettingsStore((state) => state.timeFormat);
  const showSeconds = useSettingsStore((state) => state.showSeconds);
  const locale = getDateFnsLocale();
  const hours = timeFormat === '12h' ? 'h:mm' : 'HH:mm';

  return (
    <>
      {format(time, showSeconds ? `${hours}:ss` : hours, { locale })}
      {!showSeconds && <span className="sic-msg-time-seconds">{format(time, ':ss', { locale })}</span>}
      {timeFormat === '12h' && ` ${format(time, 'a', { locale })}`}
    </>
  );
};

export default MessageTime;
