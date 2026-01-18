import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { useContextMenu } from '../providers/ContextMenuContext';
import { setAddChannel, useChannelsStore } from '../store/channels';
import { ChannelCategory } from '../types';
import { getCurrentChannelCategory, getCurrentChannelName, getCurrentNick, getCurrentUserFlags, getMonitorLimit, getSilenceLimit, getWatchLimit, setCurrentChannelName } from '../store/settings';
import { ircSendRawMessage } from '../network/irc/network';
import { useTranslation } from 'react-i18next';
import { getCurrentUserChannelModes, getUser } from '../store/users';

// Helper to determine what mode hierarchy level a flag represents
const getModeLevel = (flag: string): number => {
  const hierarchy: Record<string, number> = {
    'q': 5, // Owner
    'a': 4, // Admin
    'o': 3, // Op
    'h': 2, // Half-op
    'v': 1, // Voice
  };
  return hierarchy[flag] ?? 0;
};

// Helper to determine what actions current user can perform
const getOperatorPermissions = (currentUserModes: string[], targetUserModes: string[]) => {
  const currentLevel = Math.max(...currentUserModes.map(getModeLevel), 0);
  const targetLevel = Math.max(...targetUserModes.map(getModeLevel), 0);

  const canPromote = (toFlag: string): boolean => {
    const toLevel = getModeLevel(toFlag);
    // Can promote to levels below current user's level
    return currentLevel > toLevel && !targetUserModes.includes(toFlag);
  };

  const canDemote = (fromFlag: string): boolean => {
    const fromLevel = getModeLevel(fromFlag);
    // Can demote from levels below current user's level
    return currentLevel > fromLevel && targetUserModes.includes(fromFlag);
  };

  return {
    currentLevel,
    targetLevel,
    canKick: currentLevel >= 2, // h or higher can kick
    canBan: currentLevel >= 3,  // o or higher can ban
    canPromoteToVoice: canPromote('v'),
    canPromoteToHalfOp: canPromote('h'),
    canPromoteToOp: canPromote('o'),
    canPromoteToAdmin: canPromote('a'),
    canPromoteToOwner: canPromote('q'),
    canDemoteFromVoice: canDemote('v'),
    canDemoteFromHalfOp: canDemote('h'),
    canDemoteFromOp: canDemote('o'),
    canDemoteFromAdmin: canDemote('a'),
    canDemoteFromOwner: canDemote('q'),
  };
};

// Helper to calculate optimal context menu position
const getContextMenuPosition = (anchorElement: HTMLElement, menuHeight = 200) => {
  const rect = anchorElement.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  // If there's not enough space below but more space above, position above
  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    return {
      left: rect.left,
      top: Math.max(0, rect.top - menuHeight),
    };
  }

  // Default: position below
  return {
    left: rect.left,
    top: rect.bottom,
  };
};

export const ContextMenu = () => {
  const { t } = useTranslation();
  const { contextMenuOpen, handleContextMenuClose, contextMenuAnchorElement, contextMenuCategory, contextMenuItem } = useContextMenu();
  const openChannels = useChannelsStore((state) => state.openChannelsShortList);

  if (contextMenuCategory === 'channel' && contextMenuItem !== undefined) {
    const handleJoin = (): void => {
      ircSendRawMessage(`JOIN ${contextMenuItem}`);
      handleContextMenuClose();
    };

    const position = contextMenuAnchorElement ? getContextMenuPosition(contextMenuAnchorElement as HTMLElement, 80) : null;

    return (
      <DropdownMenu open={contextMenuOpen} onOpenChange={(open) => !open && handleContextMenuClose()}>
        <DropdownMenuContent
          style={
            position
              ? {
                  position: 'fixed',
                  left: `${position.left}px`,
                  top: `${position.top}px`,
                }
              : undefined
          }
        >
          <DropdownMenuLabel>{contextMenuItem ?? ''}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleJoin}>{t('contextmenu.channel.join')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (contextMenuCategory === 'user' && contextMenuItem !== undefined) {
    const handlePriv = (): void => {
      setAddChannel(contextMenuItem, ChannelCategory.priv);
      setCurrentChannelName(contextMenuItem, ChannelCategory.priv);
      handleContextMenuClose();
    };

    const handleWhois = (): void => {
      ircSendRawMessage(`WHOIS ${contextMenuItem}`);
      handleContextMenuClose();
    };

    const handleAddFriend = (): void => {
      const watchLimit = getWatchLimit();
      const monitorLimit = getMonitorLimit();

      if (monitorLimit > 0) {
        ircSendRawMessage(`MONITOR + ${contextMenuItem}`);
      } else if (watchLimit > 0) {
        ircSendRawMessage(`WATCH +${contextMenuItem}`);
      }
      handleContextMenuClose();
    };

    const handleIgnore = (): void => {
      const user = getUser(contextMenuItem);
      if (user !== undefined) {
        const hostmask = `${user.nick}!${user.ident}@${user.hostname}`;
        ircSendRawMessage(`SILENCE +${hostmask}`);
      }
      handleContextMenuClose();
    };

    const handleKick = (): void => {
      const channelName = getCurrentChannelName();
      ircSendRawMessage(`KICK ${channelName} ${contextMenuItem}`);
      handleContextMenuClose();
    };

    const handleBan = (): void => {
      const channelName = getCurrentChannelName();
      const user = getUser(contextMenuItem);
      if (user !== undefined) {
        const hostmask = `*!*@${user.hostname}`;
        ircSendRawMessage(`MODE ${channelName} +b ${hostmask}`);
      }
      handleContextMenuClose();
    };

    const handleKickBan = (): void => {
      const channelName = getCurrentChannelName();
      const user = getUser(contextMenuItem);
      if (user !== undefined) {
        const hostmask = `*!*@${user.hostname}`;
        ircSendRawMessage(`MODE ${channelName} +b ${hostmask}`);
        ircSendRawMessage(`KICK ${channelName} ${contextMenuItem}`);
      }
      handleContextMenuClose();
    };

    const handleModeChange = (mode: string, add: boolean): void => {
      const channelName = getCurrentChannelName();
      ircSendRawMessage(`MODE ${channelName} ${add ? '+' : '-'}${mode} ${contextMenuItem}`);
      handleContextMenuClose();
    };

    const handleInvite = (channelName: string): void => {
      ircSendRawMessage(`INVITE ${contextMenuItem} ${channelName}`);
      handleContextMenuClose();
    };

    const channelName = getCurrentChannelName();

    // Get channels the current user is in (excluding privs, status, debug)
    const userChannels = openChannels.filter((ch) => ch.category === ChannelCategory.channel).filter((channel) => channel.name !== channelName);

    // Check global user registration and feature availability
    const currentNick = getCurrentNick();
    const isCurrentUser = contextMenuItem === currentNick;
    const currentUserFlags = getCurrentUserFlags();
    const isRegistered = currentUserFlags.includes('r');
    const watchLimit = getWatchLimit();
    const monitorLimit = getMonitorLimit();
    const silenceLimit = getSilenceLimit();
    const canAddFriend = !isCurrentUser && isRegistered && (watchLimit > 0 || monitorLimit > 0);
    const canIgnore = !isCurrentUser && isRegistered && silenceLimit > 0;

    // Check channel-specific operator permissions
    const channelCategory = getCurrentChannelCategory();
    const isInChannel = channelCategory === ChannelCategory.channel;
    const currentUserChannelModes = isInChannel ? getCurrentUserChannelModes(channelName) : [];
    const targetUser = getUser(contextMenuItem);
    const targetUserChannelModes = isInChannel && targetUser ? (targetUser.channels.find(ch => ch.name === channelName)?.flags ?? []) : [];

    const permissions = getOperatorPermissions(currentUserChannelModes, targetUserChannelModes);
    const hasOperatorActions = isInChannel && (permissions.currentLevel >= 2); // At least half-op

    const position = contextMenuAnchorElement ? getContextMenuPosition(contextMenuAnchorElement as HTMLElement, 300) : null;

    return (
      <DropdownMenu open={contextMenuOpen} onOpenChange={(open) => !open && handleContextMenuClose()}>
        <DropdownMenuContent
          style={
            position
              ? {
                  position: 'fixed',
                  left: `${position.left}px`,
                  top: `${position.top}px`,
                }
              : undefined
          }
        >
          <DropdownMenuLabel>{contextMenuItem ?? ''}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!isCurrentUser && <DropdownMenuItem onClick={handlePriv}>{t('contextmenu.user.priv')}</DropdownMenuItem>}
          <DropdownMenuItem onClick={handleWhois}>{t('contextmenu.user.whois')}</DropdownMenuItem>
          {canAddFriend && <DropdownMenuItem onClick={handleAddFriend}>{t('contextmenu.user.addfriend')}</DropdownMenuItem>}
          {canIgnore && <DropdownMenuItem onClick={handleIgnore}>{t('contextmenu.user.ignore')}</DropdownMenuItem>}
          {!isCurrentUser && userChannels.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t('contextmenu.user.invite')}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {userChannels.map((channel) => (
                  <DropdownMenuItem key={channel.name} onClick={() => handleInvite(channel.name)}>
                    {channel.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {hasOperatorActions && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t('contextmenu.user.operator.title')}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {/* Promotion options */}
                  {(permissions.canPromoteToVoice || permissions.canPromoteToHalfOp || permissions.canPromoteToOp || permissions.canPromoteToAdmin || permissions.canPromoteToOwner) && (
                    <>
                      {permissions.canPromoteToVoice && <DropdownMenuItem onClick={() => handleModeChange('v', true)}>{t('contextmenu.user.operator.give.voice')}</DropdownMenuItem>}
                      {permissions.canPromoteToHalfOp && <DropdownMenuItem onClick={() => handleModeChange('h', true)}>{t('contextmenu.user.operator.give.halfop')}</DropdownMenuItem>}
                      {permissions.canPromoteToOp && <DropdownMenuItem onClick={() => handleModeChange('o', true)}>{t('contextmenu.user.operator.give.op')}</DropdownMenuItem>}
                      {permissions.canPromoteToAdmin && <DropdownMenuItem onClick={() => handleModeChange('a', true)}>{t('contextmenu.user.operator.give.admin')}</DropdownMenuItem>}
                      {permissions.canPromoteToOwner && <DropdownMenuItem onClick={() => handleModeChange('q', true)}>{t('contextmenu.user.operator.give.owner')}</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Demotion options */}
                  {(permissions.canDemoteFromVoice || permissions.canDemoteFromHalfOp || permissions.canDemoteFromOp || permissions.canDemoteFromAdmin || permissions.canDemoteFromOwner) && (
                    <>
                      {permissions.canDemoteFromOwner && <DropdownMenuItem onClick={() => handleModeChange('q', false)}>{t('contextmenu.user.operator.remove.owner')}</DropdownMenuItem>}
                      {permissions.canDemoteFromAdmin && <DropdownMenuItem onClick={() => handleModeChange('a', false)}>{t('contextmenu.user.operator.remove.admin')}</DropdownMenuItem>}
                      {permissions.canDemoteFromOp && <DropdownMenuItem onClick={() => handleModeChange('o', false)}>{t('contextmenu.user.operator.remove.op')}</DropdownMenuItem>}
                      {permissions.canDemoteFromHalfOp && <DropdownMenuItem onClick={() => handleModeChange('h', false)}>{t('contextmenu.user.operator.remove.halfop')}</DropdownMenuItem>}
                      {permissions.canDemoteFromVoice && <DropdownMenuItem onClick={() => handleModeChange('v', false)}>{t('contextmenu.user.operator.remove.voice')}</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Kick/Ban options */}
                  {permissions.canKick && !isCurrentUser && <DropdownMenuItem onClick={handleKick}>{t('contextmenu.user.operator.kick')}</DropdownMenuItem>}
                  {permissions.canBan && !isCurrentUser && <DropdownMenuItem onClick={handleBan}>{t('contextmenu.user.operator.ban')}</DropdownMenuItem>}
                  {permissions.canKick && permissions.canBan && !isCurrentUser && <DropdownMenuItem onClick={handleKickBan}>{t('contextmenu.user.operator.kickban')}</DropdownMenuItem>}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return <></>;
};
