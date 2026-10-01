import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/shared/lib/dateLocale';

interface DateSeparatorProps {
  date: Date;
  fontSizeClass: string;
}

const DateSeparator = ({ date, fontSizeClass }: DateSeparatorProps) => {
  const { t } = useTranslation();
  const locale = getDateFnsLocale();
  return (
    <div className={`sic-date-separator flex items-center gap-3 px-4 py-2 ${fontSizeClass}`} role="separator">
      <span className="sic-date-separator-time hidden">
        {format(date, 'HH:mm', { locale })}
        <span className="sic-msg-time-seconds">{format(date, ':ss', { locale })}</span>
      </span>
      <div className="sic-date-separator-rule flex-1 border-t border-muted-foreground/25" />
      <span className="sic-date-separator-label text-xs text-muted-foreground whitespace-nowrap">
        {t('main.chat.dateChanged', { date: format(date, 'PPP', { locale }) })}
      </span>
      <div className="sic-date-separator-rule flex-1 border-t border-muted-foreground/25" />
    </div>
  );
};

export default DateSeparator;
