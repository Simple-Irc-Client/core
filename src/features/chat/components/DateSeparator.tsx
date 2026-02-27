import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/shared/lib/dateLocale';

const DateSeparator = ({ date }: { date: Date }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 py-2" role="separator">
      <div className="flex-1 border-t border-muted-foreground/25" />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {t('main.chat.dateChanged', { date: format(date, 'PPP', { locale: getDateFnsLocale() }) })}
      </span>
      <div className="flex-1 border-t border-muted-foreground/25" />
    </div>
  );
};

export default DateSeparator;
