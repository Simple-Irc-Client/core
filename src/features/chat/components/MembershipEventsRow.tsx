import { memo, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MessageColor } from '@/config/theme';
import { cn } from '@shared/lib/utils';
import { type Message } from '@shared/types';
import { summarizeEvents, type EventsSummary } from '../membershipEvents';
import MessageTime from './MessageTime';

/** Past this many names a list ends in "+N" */
const NAMES_SHOWN = 3;

const SUMMARY_PARTS: { key: string; names: (summary: EventsSummary) => string[] }[] = [
  { key: 'main.events.joined', names: (summary) => summary.joined },
  { key: 'main.events.left', names: (summary) => summary.left },
  { key: 'main.events.joinedAndLeft', names: (summary) => summary.joinedAndLeft },
  { key: 'main.events.rejoined', names: (summary) => summary.rejoined },
  { key: 'main.events.renamed', names: (summary) => summary.renamed.map(({ from, to }) => `${from} → ${to}`) },
];

interface MembershipEventsRowProps {
  id: string;
  /** At least two, in order */
  events: Message[];
  expanded: boolean;
  onToggle: (id: string) => void;
  fontSizeClass: string;
  fold: (nick: string) => string;
}

/** One line for a run of joins, parts, quits and nick changes; it toggles the lines themselves */
const MembershipEventsRow = ({ id, events, expanded, onToggle, fontSizeClass, fold }: MembershipEventsRowProps) => {
  const { t } = useTranslation();
  const summary = useMemo(() => summarizeEvents(events, fold), [events, fold]);

  const listNames = (names: string[]): string =>
    names.length <= NAMES_SHOWN + 1
      ? names.join(', ')
      : `${names.slice(0, NAMES_SHOWN).join(', ')} ${t('main.events.more', { count: names.length - NAMES_SHOWN })}`;

  const text = SUMMARY_PARTS.flatMap(({ key, names }) => {
    const list = names(summary);
    return list.length === 0 ? [] : [t(key, { names: listNames(list) })];
  }).join(' · ');

  const time = new Date(events[0]?.time ?? 0);

  return (
    <div className="sic-msg" data-category="events" data-expanded={expanded || undefined}>
      <div className="sic-msg-gutter" />
      <div className="sic-msg-content min-w-0">
        <div className={`sic-msg-line ${fontSizeClass}`}>
          <span className="sic-msg-time sic-msg-time-inline">
            <MessageTime time={time} />
          </span>
          <button
            type="button"
            className="group sic-msg-body sic-msg-events-toggle cursor-pointer text-left"
            style={{ color: MessageColor.info }}
            aria-expanded={expanded}
            onClick={() => onToggle(id)}
          >
            <ChevronRight className={cn('sic-msg-events-chevron mr-1 inline h-3.5 w-3.5 align-[-2px] transition-transform', expanded && 'rotate-90')} />
            <span className="group-hover:underline">{text}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(MembershipEventsRow);
