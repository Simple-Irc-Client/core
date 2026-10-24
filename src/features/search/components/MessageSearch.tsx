import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import ChannelIcon from '@features/channels/components/ChannelIcon';
import { useChannelsStore } from '@features/channels/store/channels';
import { timePattern } from '@features/chat/components/MessageTime';
import { goToMessage } from '@features/chat/store/goToMessage';
import { useSettingsStore } from '@features/settings/store/settings';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@shared/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog';
import { Switch } from '@shared/components/ui/switch';
import { getDateFnsLocale } from '@shared/lib/dateLocale';
import { getDisplayNickFromMessage } from '@shared/lib/displayName';
import { ChannelCategory } from '@shared/types';
import { searchMessages, type SearchResult } from '../search';

/** More than this many matches: only the newest are listed */
const MAX_SHOWN_RESULTS = 100;

// Text kept before the first match when the message is cut to show it
const SNIPPET_LEAD = 40;

/** The message from shortly before the first match, each match marked */
const Snippet = ({ text, matches }: Pick<SearchResult, 'text' | 'matches'>) => {
  const firstStart = matches[0]?.[0] ?? 0;
  const start = firstStart > SNIPPET_LEAD ? firstStart - SNIPPET_LEAD : 0;
  const parts: React.ReactNode[] = start > 0 ? ['…'] : [];
  let position = start;
  for (const [matchStart, matchEnd] of matches) {
    parts.push(text.slice(position, matchStart), <mark key={matchStart} className="rounded-sm bg-primary/20 text-foreground">{text.slice(matchStart, matchEnd)}</mark>);
    position = matchEnd;
  }
  parts.push(text.slice(position));

  return <p className="line-clamp-2 text-sm break-words whitespace-normal">{parts}</p>;
};

const Results = ({ onDone }: { onDone: () => void }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [inCurrentWindow, setInCurrentWindow] = useState(false);
  const channels = useChannelsStore((state) => state.openChannels);
  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const timeFormat = useSettingsStore((state) => state.timeFormat);
  const showSeconds = useSettingsStore((state) => state.showSeconds);
  // Typing stays responsive while a long history is searched
  const deferredQuery = useDeferredValue(query);
  const canSearchCurrentWindow = currentChannelCategory !== ChannelCategory.debug;
  const scope = inCurrentWindow && canSearchCurrentWindow ? currentChannelName : undefined;
  const results = useMemo(() => searchMessages(channels, deferredQuery, scope), [channels, deferredQuery, scope]);
  const locale = getDateFnsLocale();
  const datePattern = `P ${timePattern(timeFormat, showSeconds)}`;

  const handleSelect = ({ channel, message }: SearchResult): void => {
    onDone();
    goToMessage(channel.name, channel.category, message.id);
  };

  return (
    <Command shouldFilter={false} label={t('search.title')}>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t('search.placeholder')} className="pr-8" />
      {canSearchCurrentWindow && (
        <label className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
          <Switch checked={inCurrentWindow} onCheckedChange={setInCurrentWindow} />
          <span className="truncate">{t('search.currentWindowOnly', { name: currentChannelName })}</span>
        </label>
      )}
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>{deferredQuery.trim() === '' ? t('search.hint') : t('search.empty')}</CommandEmpty>
        {results.slice(0, MAX_SHOWN_RESULTS).map((result) => (
          <CommandItem key={`${result.channel.name} ${result.message.id}`} value={`${result.channel.name} ${result.message.id}`} onSelect={() => handleSelect(result)} className="items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <ChannelIcon category={result.channel.category} />
                <span className="truncate font-medium text-foreground">{result.channel.displayName || result.channel.name}</span>
                <span className="truncate">{getDisplayNickFromMessage(result.message)}</span>
                <time className="ml-auto shrink-0" dateTime={result.message.time}>{format(new Date(result.message.time), datePattern, { locale })}</time>
              </div>
              <Snippet text={result.text} matches={result.matches} />
            </div>
          </CommandItem>
        ))}
      </CommandList>
      {results.length > MAX_SHOWN_RESULTS && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t('search.more', { count: MAX_SHOWN_RESULTS })}</p>
      )}
    </Command>
  );
};

interface MessageSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Searches what the open windows hold: what was seen here or fetched as history */
const MessageSearch = ({ open, onOpenChange }: MessageSearchProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" data-testid="message-search">
        <DialogTitle className="sr-only">{t('search.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('search.description')}</DialogDescription>
        <Results onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default MessageSearch;
