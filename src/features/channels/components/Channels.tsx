import { useMemo, useState } from 'react';
import { Hash, Home, Wrench, User, X, Plus, WifiOff } from 'lucide-react';
import { setCurrentChannelName, useSettingsStore, type FontSize } from '@features/settings/store/settings';
import { ChannelCategory, type Channel } from '@shared/types';
import Avatar from '@shared/components/Avatar';
import { serverIcons } from '@/network/irc/servers';

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
  const isConnected = useSettingsStore((state) => state.isConnected);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const server = useSettingsStore((state) => state.server);
  const networkName = useSettingsStore((state) => state.networkName);
  const openChannelsShort = useChannelsStore((state) => state.openChannelsShortList);
  const fontSizeClass = fontSizeClasses[fontSize];

  const { isChannelsDrawerOpen, setChannelsDrawerStatus } = useChannelsDrawer();

  const isChannelListLoadingFinished = useChannelListStore((state) => state.finished);

  const channelsList = useMemo(() => (isChannelListLoadingFinished ? (getChannelListSortedByUsers() ?? []) : []), [isChannelListLoadingFinished]);

  const [showRemoveChannelIcon, setShowRemoveChannelIcon] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const openChannelNames = useMemo(() => openChannelsShort.map((ch) => ch.name), [openChannelsShort]);

  const groupedChannels = useMemo(() => {
    const groups: { category: ChannelCategory; label: string; channels: Channel[] }[] = [];
    const categoryOrder: ChannelCategory[] = [ChannelCategory.status, ChannelCategory.debug, ChannelCategory.channel, ChannelCategory.priv];
    const labelKeys: Record<ChannelCategory, string> = {
      [ChannelCategory.status]: '',
      [ChannelCategory.debug]: '',
      [ChannelCategory.channel]: 'main.channels.categoryChannels',
      [ChannelCategory.priv]: 'main.channels.categoryDirectMessages',
    };

    for (const cat of categoryOrder) {
      const channels = openChannelsShort.filter((ch) => ch.category === cat);
      if (channels.length > 0) {
        groups.push({ category: cat, label: labelKeys[cat], channels });
      }
    }
    // Always include the "Channels" group so the join button is accessible
    if (!groups.some((g) => g.category === ChannelCategory.channel)) {
      const insertIdx = groups.findIndex((g) => g.category === ChannelCategory.priv);
      groups.splice(insertIdx === -1 ? groups.length : insertIdx, 0, { category: ChannelCategory.channel, label: labelKeys[ChannelCategory.channel], channels: [] });
    }
    return groups;
  }, [openChannelsShort]);

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
    <nav
      aria-label={t('main.channels.title')}
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
          <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {(() => {
                const iconKey = networkName ?? server?.network;
                return iconKey && iconKey in serverIcons ? (
                  <span
                    className="h-5 w-5 flex-shrink-0"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: serverIcons[iconKey] as string }}
                  />
                ) : null;
              })()}
              <h3 className={`${fontSizeClass} font-semibold truncate`}>{networkName ?? server?.network ?? t('main.channels.title')}</h3>
            </div>
            {isChannelsDrawerOpen && (
              <Button variant="ghost" onClick={setChannelsDrawerStatus} className="h-8 w-8 p-0 lg:hidden flex-shrink-0" aria-label={t('main.channels.closeDrawer')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!isConnected && (
            <div role="status" aria-live="polite" className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 text-xs">
              <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{t('main.chat.notConnected')}</span>
            </div>
          )}
          <div>
            {groupedChannels.map((group) => (
              <div key={group.category}>
                {group.label && (
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(group.label)}</span>
                    {group.category === ChannelCategory.channel && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDialogOpen(true)}
                              disabled={!isConnected}
                              aria-label={t('main.channels.join')}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('main.channels.join')}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
                {group.channels.map((channel) => (
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
                      aria-current={currentChannelName === channel.name ? 'page' : undefined}
                      onClick={() => {
                        handleListItemClick(channel);
                      }}
                      className={cn(
                        `w-full flex items-center gap-2 px-4 py-2 text-left ${fontSizeClass} hover:bg-gray-100 dark:hover:bg-gray-800`,
                        currentChannelName === channel.name && 'bg-gray-200 dark:bg-gray-700',
                      )}
                    >
                      <span className="min-w-7.5 flex items-center justify-center">
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
                      <span className="flex-1">{channel.displayName || channel.name}</span>
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {![DEBUG_CHANNEL, STATUS_CHANNEL].includes(channel.name) && (
                        <>
                          {showRemoveChannelIcon !== channel.name && channel.unReadMessages > 0 && (
                            <Badge variant={channel.hasMention ? 'destructive' : 'default'} className="h-5 min-w-5 flex items-center justify-center text-xs" aria-label={channel.hasMention ? t('main.channels.unreadMentions', { count: channel.unReadMessages }) : t('main.channels.unreadCount', { count: channel.unReadMessages })}>{channel.unReadMessages > 99 ? '99+' : channel.unReadMessages}</Badge>
                          )}
                          {(channel.category === ChannelCategory.channel || channel.category === ChannelCategory.priv) && showRemoveChannelIcon === channel.name && isConnected && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t('main.channels.leave', { channel: channel.name })}
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
    </nav>
  );
};

export default Channels;
