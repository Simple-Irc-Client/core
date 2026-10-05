import { useTranslation } from 'react-i18next';
import { monitorKey, useMonitorStore } from '@features/monitor/store/monitor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import { cn } from '@shared/lib/utils';

interface DmPresenceDotProps {
  nick: string;
  className?: string;
}

/** Renders nothing until a status is known, so an unknown peer doesn't flash "offline". */
const DmPresenceDot = ({ nick, className }: DmPresenceDotProps) => {
  const { t } = useTranslation();
  const status = useMonitorStore((state) => state.monitoredUsers.get(monitorKey(nick)));

  if (!status) {
    return null;
  }

  const label = status.online ? t('main.dmPresence.online') : t('main.dmPresence.offline');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            className={cn(
              'inline-block h-2 w-2 rounded-full flex-shrink-0',
              status.online ? 'bg-green-500' : 'bg-background border border-muted-foreground/60',
              className,
            )}
          />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default DmPresenceDot;
