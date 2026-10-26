import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ChannelIcon from '@features/channels/components/ChannelIcon';
import UnreadBadge from '@features/channels/components/UnreadBadge';
import { useActiveChannels } from '@features/channels/store/channels';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@shared/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog';
import { type Channel } from '@shared/types';
import { switcherOrder } from '../shortcuts';
import { useActiveSession } from '@features/networks/store/networks';
import { setCurrentChannelName } from '@features/networks/currentChannel';

interface QuickSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuickSwitcher = ({ open, onOpenChange }: QuickSwitcherProps) => {
  const { t } = useTranslation();
  const channels = useActiveChannels((slice) => slice.openChannelsShortList);
  const currentChannelName = useActiveSession((session) => session.currentChannelName);
  const ordered = useMemo(() => switcherOrder(channels, currentChannelName), [channels, currentChannelName]);

  const handleSelect = (channel: Channel): void => {
    setCurrentChannelName(channel.name, channel.category);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md" data-testid="quick-switcher">
        <DialogTitle className="sr-only">{t('shortcuts.switcher.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('shortcuts.switcher.description')}</DialogDescription>
        <Command>
          <CommandInput placeholder={t('shortcuts.switcher.placeholder')} aria-label={t('shortcuts.switcher.title')} className="pr-8" />
          <CommandList>
            <CommandEmpty>{t('shortcuts.switcher.empty')}</CommandEmpty>
            {ordered.map((channel) => (
              <CommandItem
                key={channel.name}
                value={channel.name}
                keywords={channel.displayName ? [channel.displayName] : undefined}
                onSelect={() => handleSelect(channel)}
              >
                <ChannelIcon category={channel.category} />
                <span className="flex-1 truncate">{channel.displayName || channel.name}</span>
                {channel.unReadMessages > 0 && <UnreadBadge channel={channel} />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default QuickSwitcher;
