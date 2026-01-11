import { useMemo, useState } from 'react';
import { Plus, Hash, Home, Wrench, User, X, Check, ChevronsUpDown } from 'lucide-react';
import { setCurrentChannelName, useSettingsStore } from '../../../store/settings';
import { ChannelCategory, type ChannelList, type Channel } from '../../../types';
import { useTranslation } from 'react-i18next';
import { isPriv, setRemoveChannel, useChannelsStore } from '../../../store/channels';
import { channelsColor, channelsWidth, channelsTitleColor } from '../../../config/theme';
import { ircJoinChannels, ircPartChannel } from '../../../network/irc/network';
import { useChannelsDrawer } from '../../../providers/ChannelsDrawerContext';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../../config/config';
import { getChannelListSortedByAZ, useChannelListStore } from '../../../store/channelList';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const Channels = () => {
  const { t } = useTranslation();

  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const openChannelsShort = useChannelsStore((state) => state.openChannelsShortList);

  const { isChannelsDrawerOpen } = useChannelsDrawer();

  const isChannelListLoadingFinished = useChannelListStore((state) => state.finished);

  const [channelsList, setChannelsList] = useState<ChannelList[]>([]);

  useMemo(() => {
    setChannelsList(isChannelListLoadingFinished ? (getChannelListSortedByAZ() ?? []) : []);
  }, [isChannelListLoadingFinished]);

  const [showRemoveChannelIcon, setShowRemoveChannelIcon] = useState('');
  const [open, setOpen] = useState(false);

  const handleHover = (channel: string, visible: boolean): void => {
    if (visible) {
      setShowRemoveChannelIcon(channel);
    } else {
      setShowRemoveChannelIcon('');
    }
  };

  const handleRemoveChannel = (channel: Channel): void => {
    if (isPriv(channel.name)) {
      setRemoveChannel(channel.name);
    } else {
      ircPartChannel(channel.name);
    }
  };

  const handleJoinChannel = (channel: string): void => {
    if (channel.length !== 0) {
      ircJoinChannels([channel]);
      setOpen(false);
    }
  };

  const handleListItemClick = (channel: Channel): void => {
    setCurrentChannelName(channel.name, channel.category);
  };

  const getChannelIcon = (category: ChannelCategory | undefined) => {
    switch (category) {
      case 'channel':
        return <Hash className="h-4 w-4" />;
      case 'priv':
        return <User className="h-4 w-4" />;
      case 'status':
        return <Home className="h-4 w-4" />;
      case 'debug':
        return <Wrench className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const ChannelsList = () => (
    <div
      className="md:bg-opacity-100"
      style={{
        minWidth: isChannelsDrawerOpen ? `${channelsWidth}px` : '',
      }}
    >
      <div className="mb-4 md:bg-opacity-100" style={{ backgroundColor: channelsTitleColor }}>
        <h3 className="text-sm font-medium p-4">{t('main.channels.title')}</h3>
      </div>
      <div>
        {openChannelsShort.map((channel) => (
          <div
            key={channel.name}
            onMouseEnter={() => {
              handleHover(channel.name, true);
            }}
            onMouseLeave={() => {
              handleHover(channel.name, false);
            }}
            className="relative"
          >
            <button
              aria-label={channel.name}
              onClick={() => {
                handleListItemClick(channel);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100',
                currentChannelName === channel.name && 'bg-gray-200'
              )}
            >
              <span className="min-w-[30px]">{getChannelIcon(channel.category)}</span>
              <span className="flex-1">{channel.name}</span>
            </button>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {![DEBUG_CHANNEL, STATUS_CHANNEL].includes(channel.name) && (
                <>
                  {showRemoveChannelIcon !== channel.name && channel.unReadMessages > 0 && (
                    <Badge className="h-5 min-w-5 flex items-center justify-center text-xs">{channel.unReadMessages > 99 ? '99+' : channel.unReadMessages}</Badge>
                  )}
                  {(channel.category === ChannelCategory.channel || channel.category === ChannelCategory.priv) && showRemoveChannelIcon === channel.name && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="close"
                      className="h-8 w-8"
                      onClick={() => {
                        handleRemoveChannel(channel);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div className="relative px-4 py-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between text-sm h-9">
                {t('main.channels.join')}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder={t('main.channels.search') ?? ''} />
                <CommandList>
                  <CommandEmpty>{t('main.channels.no-results')}</CommandEmpty>
                  <CommandGroup>
                    {channelsList
                      .filter((option) => !openChannelsShort.map((channel) => channel.name).includes(option.name))
                      .map((option) => (
                        <CommandItem
                          key={option.name}
                          value={option.name}
                          onSelect={(currentValue) => {
                            handleJoinChannel(currentValue);
                            setOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4 opacity-0')} />
                          {option.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={cn('overflow-y-auto transition-all duration-300', isChannelsDrawerOpen ? 'w-auto' : 'w-0')}
      style={{
        minWidth: isChannelsDrawerOpen ? `${channelsWidth}px` : '0',
      }}
    >
      {isChannelsDrawerOpen && <ChannelsList />}
    </div>
  );
};

export default Channels;
