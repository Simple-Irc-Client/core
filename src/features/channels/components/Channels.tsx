import { useMemo, useState } from 'react';
import { Hash, Home, Wrench, User, X, Plus } from 'lucide-react';
import { setCurrentChannelName, useSettingsStore, type FontSize } from '@features/settings/store/settings';
import { ChannelCategory, type Channel } from '@shared/types';
import Avatar from '@shared/components/Avatar';

const fontSizeClasses: Record<FontSize, string> = {
  small: 'text-xs',
  medium: 'text-sm',
  large: 'text-base',
};
import { useTranslation } from 'react-i18next';
import { isPriv, setRemoveChannel, useChannelsStore } from '@features/channels/store/channels';
import { channelsWidth as defaultChannelsWidth } from '@/config/theme';
import { ircJoinChannels, ircPartChannel } from '@/network/irc/network';
import { useChannelsDrawer } from '@/providers/DrawersContext';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { getChannelListSortedByUsers, useChannelListStore } from '@features/channels/store/channelList';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { cn } from '@shared/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import ChannelListDialog from '@shared/components/ChannelListDialog';

interface ChannelsProps {
  width?: number;
}

const Channels = ({ width = defaultChannelsWidth }: ChannelsProps) => {
  const { t } = useTranslation();

  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const openChannelsShort = useChannelsStore((state) => state.openChannelsShortList);
  const fontSizeClass = fontSizeClasses[fontSize];

  const { isChannelsDrawerOpen, setChannelsDrawerStatus } = useChannelsDrawer();

  const isChannelListLoadingFinished = useChannelListStore((state) => state.finished);

  const channelsList = useMemo(() => (isChannelListLoadingFinished ? (getChannelListSortedByUsers() ?? []) : []), [isChannelListLoadingFinished]);

  const [showRemoveChannelIcon, setShowRemoveChannelIcon] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const openChannelNames = useMemo(() => openChannelsShort.map((ch) => ch.name), [openChannelsShort]);

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

  const handleJoinChannels = (channels: string[]): void => {
    if (channels.length > 0) {
      ircJoinChannels(channels);
    }
  };

  const handleListItemClick = (channel: Channel): void => {
    setCurrentChannelName(channel.name, channel.category);
    // Close drawer on mobile/tablet (below lg breakpoint)
    if (window.matchMedia?.('(max-width: 1023px)').matches) {
      setChannelsDrawerStatus();
    }
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

  return (
    <div
      className={cn(
        'border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-background',
        !isChannelsDrawerOpen && 'hidden lg:block',
        isChannelsDrawerOpen && 'absolute left-0 top-0 bottom-0 z-20 lg:relative lg:z-auto',
      )}
      style={{
        width: `${width}px`,
        minWidth: `${defaultChannelsWidth}px`,
      }}
    >
      <div>
          <div className="mb-4 flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <h3 className={`${fontSizeClass} font-medium`}>{t('main.channels.title')}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setDialogOpen(true)}
                      aria-label={t('main.channels.join')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('main.channels.join')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {isChannelsDrawerOpen && (
              <Button variant="ghost" onClick={setChannelsDrawerStatus} className="h-8 w-8 p-0 lg:hidden">
                <X className="h-4 w-4" />
              </Button>
            )}
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
                    `w-full flex items-center gap-2 px-4 py-2 text-left ${fontSizeClass} hover:bg-gray-100 dark:hover:bg-gray-800`,
                    currentChannelName === channel.name && 'bg-gray-200 dark:bg-gray-700',
                  )}
                >
                  <span className="min-w-[30px] flex items-center justify-center">
                    {channel.avatar ? (
                      <Avatar
                        src={channel.avatar}
                        alt={channel.name}
                        fallbackLetter={channel.name.substring(1, 2).toUpperCase()}
                        className="h-4 w-4"
                      />
                    ) : (
                      getChannelIcon(channel.category)
                    )}
                  </span>
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
          </div>
        </div>
      <ChannelListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        channelList={channelsList}
        isLoading={!isChannelListLoadingFinished}
        onJoin={handleJoinChannels}
        excludeChannels={openChannelNames}
      />
    </div>
  );
};

export default Channels;
