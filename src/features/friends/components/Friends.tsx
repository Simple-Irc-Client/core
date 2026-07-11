import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, X } from 'lucide-react';
import { setAddChannel } from '@features/channels/store/channels';
import { setCurrentChannelName, useSettingsStore } from '@features/settings/store/settings';
import { useMonitorStore } from '@features/monitor/store/monitor';
import { useFriendsStore } from '@features/friends/store/friends';
import { removeFriend } from '@features/friends/friends';
import { ChannelCategory } from '@shared/types';
import { Button } from '@shared/components/ui/button';
import { cn } from '@shared/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import { useChannelsDrawer } from '@/providers/DrawersContext';
import AddFriendDialog from './AddFriendDialog';

interface FriendsProps {
  fontSizeClass: string;
}

const Friends = ({ fontSizeClass }: FriendsProps) => {
  const { t } = useTranslation();

  const server = useSettingsStore((state) => state.server);
  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const friendsByNetwork = useFriendsStore((state) => state.friendsByNetwork);
  const monitoredUsers = useMonitorStore((state) => state.monitoredUsers);
  const { setChannelsDrawerStatus } = useChannelsDrawer();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [hoveredFriend, setHoveredFriend] = useState('');

  const network = server?.network;

  const friends = useMemo(() => {
    const nicks = network !== undefined ? (friendsByNetwork[network] ?? []) : [];
    return nicks
      .map((nick) => ({ nick, online: monitoredUsers.get(nick.toLowerCase())?.online ?? false }))
      .sort((a, b) => (a.online === b.online ? a.nick.localeCompare(b.nick) : (a.online ? -1 : 1)));
  }, [network, friendsByNetwork, monitoredUsers]);

  if (network === undefined) {
    return null;
  }

  const handleFriendClick = (nick: string): void => {
    setAddChannel(nick, ChannelCategory.priv);
    setCurrentChannelName(nick, ChannelCategory.priv);
    // Close drawer on mobile/tablet (below lg breakpoint)
    if (globalThis.matchMedia?.('(max-width: 1023px)').matches) {
      setChannelsDrawerStatus();
    }
  };

  return (
    <div data-testid="friends-section">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('main.friends.title')}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setDialogOpen(true)}
                aria-label={t('main.friends.add')}
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('main.friends.add')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {friends.map((friend) => (
        <div
          key={friend.nick}
          onMouseEnter={() => setHoveredFriend(friend.nick)}
          onMouseLeave={() => setHoveredFriend('')}
          className="relative"
        >
          <button
            aria-label={friend.nick}
            aria-current={currentChannelName === friend.nick ? 'page' : undefined}
            onClick={() => handleFriendClick(friend.nick)}
            className={cn(
              `w-full flex items-center gap-2 px-4 py-2 text-left ${fontSizeClass} hover:bg-muted`,
              currentChannelName === friend.nick && 'bg-muted',
            )}
          >
            <span className="min-w-7.5 flex items-center justify-center">
              <span
                role="img"
                aria-label={friend.online ? t('main.friends.online') : t('main.friends.offline')}
                className={cn('h-2.5 w-2.5 rounded-full', friend.online ? 'bg-green-500' : 'border border-muted-foreground/60')}
              />
            </span>
            <span className={cn('flex-1', !friend.online && 'text-muted-foreground')}>{friend.nick}</span>
          </button>
          {hoveredFriend === friend.nick && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('main.friends.remove', { nick: friend.nick })}
                className="h-8 w-8"
                onClick={() => removeFriend(friend.nick)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ))}
      <AddFriendDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default Friends;
