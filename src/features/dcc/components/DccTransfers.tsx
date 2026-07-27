/**
 * DCC transfers section in the channels sidebar.
 *
 * Renders only when there is something to show (or DCC is unavailable and the
 * user asked for it), so it costs nothing for the majority of users who never
 * touch DCC.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowUpFromLine, MessageSquare, Settings, X } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Progress } from '@shared/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import { cn } from '@shared/lib/utils';
import { cancelDccSession } from '../manager';
import { DccKind } from '../protocol';
import { isDccFinished, useDccSessionsStore } from '../store/dcc';
import { formatBytes, formatRate, transferPercent } from '../format';
import { DccDirection, DccStatus, type DccSession } from '../types';
import DccSettingsDialog from './DccSettingsDialog';

interface DccTransfersProps {
  fontSizeClass: string;
}

const statusTone: Record<DccStatus, string> = {
  [DccStatus.pending]: 'text-amber-600',
  [DccStatus.connecting]: 'text-muted-foreground',
  [DccStatus.active]: 'text-green-600',
  [DccStatus.completed]: 'text-muted-foreground',
  [DccStatus.failed]: 'text-destructive',
  [DccStatus.declined]: 'text-muted-foreground',
  [DccStatus.cancelled]: 'text-muted-foreground',
};

const DccTransferRow = ({ session, fontSizeClass }: { session: DccSession; fontSizeClass: string }) => {
  const { t } = useTranslation();
  const percent = transferPercent(session.transferred, session.size);
  const finished = isDccFinished(session.status);

  const Icon =
    session.kind === DccKind.chat
      ? MessageSquare
      : session.direction === DccDirection.incoming
        ? ArrowDownToLine
        : ArrowUpFromLine;

  return (
    <div className={cn('px-4 py-2', fontSizeClass)} data-testid="dcc-transfer-row">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 truncate" title={session.filename ?? session.nick}>
          {session.filename ?? session.nick}
        </span>
        {!finished && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={t('dcc.cancel', { nick: session.nick })}
            onClick={() => void cancelDccSession(session.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className={statusTone[session.status]}>{t(`dcc.status.${session.status}`)}</span>
        {session.kind === DccKind.send && !finished && (
          <span>
            {formatBytes(session.transferred)} / {formatBytes(session.size)} · {formatRate(session.rate)}
          </span>
        )}
      </div>

      {session.kind === DccKind.send && percent !== null && !finished && (
        <Progress value={percent} className="mt-1 h-1" />
      )}

      {session.status === DccStatus.failed && session.error !== undefined && (
        <p className="mt-0.5 text-xs text-destructive">{session.error}</p>
      )}
    </div>
  );
};

const DccTransfers = ({ fontSizeClass }: DccTransfersProps) => {
  const { t } = useTranslation();
  const sessions = useDccSessionsStore((state) => state.sessions);
  const clearFinishedDccSessions = useDccSessionsStore((state) => state.clearFinishedDccSessions);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Chat sessions already have their own sidebar window; listing them here too
  // would double them up. Only transfers and failed chats need a row.
  const rows = sessions.filter(
    (session) => session.kind === DccKind.send || session.status === DccStatus.failed,
  );

  if (rows.length === 0) {
    return null;
  }

  const hasFinished = rows.some((session) => isDccFinished(session.status));

  return (
    <div data-testid="dcc-transfers-section">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('dcc.title')}
        </span>
        <div className="flex items-center">
          {hasFinished && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={clearFinishedDccSessions}
            >
              {t('dcc.clearFinished')}
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t('dcc.settings.title')}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('dcc.settings.title')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {rows.map((session) => (
        <DccTransferRow key={session.id} session={session} fontSizeClass={fontSizeClass} />
      ))}

      <DccSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

export default DccTransfers;
