import { useCallback, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@shared/components/ui/dropdown-menu';
import { useContextMenu } from '@/providers/ContextMenuContext';
import { useUsersDrawer } from '@/providers/DrawersContext';
import { setAddChannel, setClearMessages, useChannelsStore } from '@features/channels/store/channels';
import { ChannelCategory } from '@shared/types';
import { getAutoOfferEncryption, getCurrentChannelCategory, getCurrentChannelName, getCurrentNick, getCurrentUserFlags, getMonitorLimit, getSilenceLimit, getWatchLimit, isSameName, setCurrentChannelName } from '@features/settings/store/settings';
import { ircSendUserCommand } from '@/network/irc/network';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Ban, Copy, ExternalLink, EyeOff, LogIn, MessageSquare, Search, Send, Shield, Trash2, UserMinus, UserPlus, UserX } from 'lucide-react';
import { getCurrentUserChannelModes, getUser } from '@features/users/store/users';
import { addFriend, isFriend, removeFriend } from '@features/friends/friends';
import { subscribeDmPresence } from '@features/dmPresence/dmPresence';
import { offerEncryption } from '@features/e2ee/session';
import { isSafeUrl } from '@shared/lib/utils';
import { clipboard, openExternal } from '@/runtime/desktop';

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

const getOperatorPermissions = (currentUserModes: string[], targetUserModes: string[]) => {
  const currentLevel = Math.max(...currentUserModes.map(getModeLevel), 0);
  const targetLevel = Math.max(...targetUserModes.map(getModeLevel), 0);

  const canPromote = (toFlag: string): boolean => {
    const toLevel = getModeLevel(toFlag);
    return currentLevel > toLevel && !targetUserModes.includes(toFlag);
  };

  const canDemote = (fromFlag: string): boolean => {
    const fromLevel = getModeLevel(fromFlag);
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

export const getMenuPosition = (
  source: HTMLElement | { x: number; y: number },
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number } => {
  const viewportWidth = globalThis.innerWidth;
  const viewportHeight = globalThis.innerHeight;

  let left: number;
  let top: number;

  if (source instanceof HTMLElement) {
    const rect = source.getBoundingClientRect();
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    left = rect.left;
    top = spaceBelow < menuHeight && spaceAbove > spaceBelow ? rect.top - menuHeight : rect.bottom;
  } else {
    left = source.x;
    top = source.y;
  }

  return {
    left: Math.max(0, Math.min(left, viewportWidth - menuWidth)),
    top: Math.max(0, Math.min(top, viewportHeight - menuHeight)),
  };
};

const PositionedMenuContent = ({
  source,
  anchorElement,
  children,
}: {
  source: HTMLElement | { x: number; y: number } | null;
  anchorElement: HTMLElement | null;
  children: React.ReactNode;
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  // Item count, font and theme decide the menu size, so position from the rendered box
  const contentRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) {
      return;
    }
    const measure = (): void => {
      setSize((prev) =>
        prev.width === el.offsetWidth && prev.height === el.offsetHeight
          ? prev
          : { width: el.offsetWidth, height: el.offsetHeight },
      );
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(el);
    }
  }, []);

  const position = source ? getMenuPosition(source, size.width, size.height) : null;
  return (
    <DropdownMenuContent
      ref={contentRef}
      style={
        position
          ? {
              position: 'fixed',
              left: `${position.left}px`,
              top: `${position.top}px`,
              maxHeight: `${globalThis.innerHeight}px`,
            }
          : undefined
      }
      onPointerDownOutside={(event) => {
        // The opening right-click's trailing mouseup/click must not count as a dismiss
        const target = event.detail.originalEvent.target;
        if (anchorElement && target instanceof Node && anchorElement.contains(target)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </DropdownMenuContent>
  );
};

export const ContextMenu = () => {
  const { t } = useTranslation();
  const { contextMenuOpen, handleContextMenuClose, contextMenuAnchorElement, contextMenuCategory, contextMenuItem, contextMenuPosition } = useContextMenu();
  const openChannels = useChannelsStore((state) => state.openChannelsShortList);
  const { isUsersDrawerOpen, toggleUsersDrawer } = useUsersDrawer();

  if (contextMenuCategory === 'channel' && contextMenuItem !== undefined) {
    const handleJoin = (): void => {
      ircSendUserCommand(`JOIN ${contextMenuItem}`);
      handleContextMenuClose();
    };

    return (
      <DropdownMenu open={contextMenuOpen} onOpenChange={(open) => !open && handleContextMenuClose()}>
        <PositionedMenuContent source={contextMenuAnchorElement} anchorElement={contextMenuAnchorElement}>
          <DropdownMenuLabel>{contextMenuItem}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleJoin}>
            <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('contextmenu.channel.join')}
          </DropdownMenuItem>
        </PositionedMenuContent>
      </DropdownMenu>
    );
  }

  if (contextMenuCategory === 'user' && contextMenuItem !== undefined) {
    const handlePriv = (): void => {
      setAddChannel(contextMenuItem, ChannelCategory.priv);
      subscribeDmPresence(contextMenuItem);
      setCurrentChannelName(contextMenuItem, ChannelCategory.priv);
      if (getAutoOfferEncryption()) {
        void offerEncryption(contextMenuItem);
      }
      // Otherwise the new conversation stays hidden behind the drawer
      if (isUsersDrawerOpen && globalThis.matchMedia?.('(max-width: 1023px)').matches) {
        toggleUsersDrawer();
      }
      handleContextMenuClose();
    };

    const handleWhois = (): void => {
      ircSendUserCommand(`WHOIS ${contextMenuItem}`);
      handleContextMenuClose();
    };

    const handleVisitHomepage = (): void => {
      const user = getUser(contextMenuItem);
      if (user?.homepage && isSafeUrl(user.homepage)) {
        void openExternal(user.homepage);
      }
      handleContextMenuClose();
    };

    const handleAddFriend = (): void => {
      addFriend(contextMenuItem);
      handleContextMenuClose();
    };

    const handleRemoveFriend = (): void => {
      removeFriend(contextMenuItem);
      handleContextMenuClose();
    };

    const handleIgnore = (): void => {
      const user = getUser(contextMenuItem);
      if (user !== undefined) {
        const hostmask = `${user.nick}!${user.ident}@${user.hostname}`;
        ircSendUserCommand(`SILENCE +${hostmask}`);
      }
      handleContextMenuClose();
    };

    const handleKick = (): void => {
      const channelName = getCurrentChannelName();
      ircSendUserCommand(`KICK ${channelName} ${contextMenuItem} :${t('kernel.kick.defaultReason')}`);
      handleContextMenuClose();
    };

    const handleBan = (): void => {
      const channelName = getCurrentChannelName();
      const user = getUser(contextMenuItem);
      if (user !== undefined) {
        const hostmask = `*!*@${user.hostname}`;
        ircSendUserCommand(`MODE ${channelName} +b ${hostmask}`);
      }
      handleContextMenuClose();
    };

    const handleKickBan = (): void => {
      const channelName = getCurrentChannelName();
      const user = getUser(contextMenuItem);
      if (user !== undefined) {
        const hostmask = `*!*@${user.hostname}`;
        ircSendUserCommand(`MODE ${channelName} +b ${hostmask}`);
        ircSendUserCommand(`KICK ${channelName} ${contextMenuItem} :${t('kernel.kick.defaultReason')}`);
      }
      handleContextMenuClose();
    };

    const handleModeChange = (mode: string, add: boolean): void => {
      const channelName = getCurrentChannelName();
      ircSendUserCommand(`MODE ${channelName} ${add ? '+' : '-'}${mode} ${contextMenuItem}`);
      handleContextMenuClose();
    };

    const handleInvite = (channelName: string): void => {
      ircSendUserCommand(`INVITE ${contextMenuItem} ${channelName}`);
      handleContextMenuClose();
    };

    const channelName = getCurrentChannelName();

    const userChannels = openChannels.filter((ch) => ch.category === ChannelCategory.channel).filter((channel) => channel.name !== channelName);

    const currentNick = getCurrentNick();
    const isCurrentUser = contextMenuItem === currentNick;
    const currentUserFlags = getCurrentUserFlags();
    const isRegistered = currentUserFlags.includes('r');
    const watchLimit = getWatchLimit();
    const monitorLimit = getMonitorLimit();
    const silenceLimit = getSilenceLimit();
    const isFriendAlready = isFriend(contextMenuItem);
    const canAddFriend = !isCurrentUser && !isFriendAlready && isRegistered && (watchLimit > 0 || monitorLimit > 0);
    const canIgnore = !isCurrentUser && isRegistered && silenceLimit > 0;

    const channelCategory = getCurrentChannelCategory();
    const isInChannel = channelCategory === ChannelCategory.channel;
    const isAlreadyInThisDm = channelCategory === ChannelCategory.priv && isSameName(channelName, contextMenuItem);
    const currentUserChannelModes = isInChannel ? getCurrentUserChannelModes(channelName) : [];
    const targetUser = getUser(contextMenuItem);
    const targetUserChannelModes = isInChannel && targetUser ? (targetUser.channels.find(ch => ch.name === channelName)?.flags ?? []) : [];
    const userHomepage = targetUser?.homepage;

    const permissions = getOperatorPermissions(currentUserChannelModes, targetUserChannelModes);
    const hasOperatorActions = isInChannel && (permissions.currentLevel >= 2); // At least half-op

    return (
      <DropdownMenu open={contextMenuOpen} onOpenChange={(open) => !open && handleContextMenuClose()}>
        <PositionedMenuContent source={contextMenuAnchorElement} anchorElement={contextMenuAnchorElement}>
          <DropdownMenuLabel>{contextMenuItem}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {userHomepage && (
            <DropdownMenuItem onClick={handleVisitHomepage} title={userHomepage}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('contextmenu.user.homepage')}
            </DropdownMenuItem>
          )}
          {!isCurrentUser && !isAlreadyInThisDm && (
            <DropdownMenuItem onClick={handlePriv}>
              <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('contextmenu.user.priv')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleWhois}>
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('contextmenu.user.whois')}
          </DropdownMenuItem>
          {canAddFriend && (
            <DropdownMenuItem onClick={handleAddFriend}>
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('contextmenu.user.addfriend')}
            </DropdownMenuItem>
          )}
          {isFriendAlready && !isCurrentUser && (
            <DropdownMenuItem onClick={handleRemoveFriend}>
              <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('contextmenu.user.removefriend')}
            </DropdownMenuItem>
          )}
          {canIgnore && (
            <DropdownMenuItem onClick={handleIgnore}>
              <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('contextmenu.user.ignore')}
            </DropdownMenuItem>
          )}
          {!isCurrentUser && userChannels.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('contextmenu.user.invite')}
              </DropdownMenuSubTrigger>
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
                <DropdownMenuSubTrigger>
                  <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('contextmenu.user.operator.title')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {(permissions.canPromoteToVoice || permissions.canPromoteToHalfOp || permissions.canPromoteToOp || permissions.canPromoteToAdmin || permissions.canPromoteToOwner) && (
                    <>
                      {permissions.canPromoteToVoice && (
                        <DropdownMenuItem onClick={() => handleModeChange('v', true)}>
                          <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.give.voice')}
                        </DropdownMenuItem>
                      )}
                      {permissions.canPromoteToHalfOp && (
                        <DropdownMenuItem onClick={() => handleModeChange('h', true)}>
                          <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.give.halfop')}
                        </DropdownMenuItem>
                      )}
                      {permissions.canPromoteToOp && (
                        <DropdownMenuItem onClick={() => handleModeChange('o', true)}>
                          <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.give.op')}
                        </DropdownMenuItem>
                      )}
                      {permissions.canPromoteToAdmin && (
                        <DropdownMenuItem onClick={() => handleModeChange('a', true)}>
                          <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.give.admin')}
                        </DropdownMenuItem>
                      )}
                      {permissions.canPromoteToOwner && (
                        <DropdownMenuItem onClick={() => handleModeChange('q', true)}>
                          <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.give.owner')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {(permissions.canDemoteFromVoice || permissions.canDemoteFromHalfOp || permissions.canDemoteFromOp || permissions.canDemoteFromAdmin || permissions.canDemoteFromOwner) && (
                    <>
                      {permissions.canDemoteFromOwner && (
                        <DropdownMenuItem onClick={() => handleModeChange('q', false)}>
                          <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.remove.owner')}
                        </DropdownMenuItem>
                      )}
                      {permissions.canDemoteFromAdmin && (
                        <DropdownMenuItem onClick={() => handleModeChange('a', false)}>
                          <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.remove.admin')}
                        </DropdownMenuItem>
                      )}
                      {permissions.canDemoteFromOp && (
                        <DropdownMenuItem onClick={() => handleModeChange('o', false)}>
                          <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.remove.op')}
                        </DropdownMenuItem>
                      )}
                      {permissions.canDemoteFromHalfOp && (
                        <DropdownMenuItem onClick={() => handleModeChange('h', false)}>
                          <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.remove.halfop')}
                        </DropdownMenuItem>
                      )}
                      {permissions.canDemoteFromVoice && (
                        <DropdownMenuItem onClick={() => handleModeChange('v', false)}>
                          <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('contextmenu.user.operator.remove.voice')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {permissions.canKick && !isCurrentUser && (
                    <DropdownMenuItem onClick={handleKick}>
                      <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('contextmenu.user.operator.kick')}
                    </DropdownMenuItem>
                  )}
                  {permissions.canBan && !isCurrentUser && (
                    <DropdownMenuItem onClick={handleBan}>
                      <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('contextmenu.user.operator.ban')}
                    </DropdownMenuItem>
                  )}
                  {permissions.canKick && permissions.canBan && !isCurrentUser && (
                    <DropdownMenuItem onClick={handleKickBan}>
                      <UserX className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('contextmenu.user.operator.kickban')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </PositionedMenuContent>
      </DropdownMenu>
    );
  }
  if (contextMenuCategory === 'url' && contextMenuItem !== undefined) {
    const handleOpenUrl = (): void => {
      if (isSafeUrl(contextMenuItem)) {
        void openExternal(contextMenuItem);
      }
      handleContextMenuClose();
    };

    const handleCopyUrl = (): void => {
      void clipboard.writeText(contextMenuItem);
      handleContextMenuClose();
    };

    const truncated = contextMenuItem.length > 50 ? contextMenuItem.substring(0, 50) + '...' : contextMenuItem;

    return (
      <DropdownMenu open={contextMenuOpen} onOpenChange={(open) => !open && handleContextMenuClose()}>
        <PositionedMenuContent source={contextMenuPosition} anchorElement={contextMenuAnchorElement}>
          <DropdownMenuLabel className="max-w-80 truncate select-none">{truncated}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenUrl}>
            <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('contextmenu.url.open')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyUrl}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('contextmenu.url.copy')}
          </DropdownMenuItem>
        </PositionedMenuContent>
      </DropdownMenu>
    );
  }

  if (contextMenuCategory === 'chat' && contextMenuItem !== undefined) {
    const handleClearScreen = (): void => {
      setClearMessages(contextMenuItem);
      handleContextMenuClose();
    };

    return (
      <DropdownMenu open={contextMenuOpen} onOpenChange={(open) => !open && handleContextMenuClose()}>
        <PositionedMenuContent source={contextMenuPosition} anchorElement={contextMenuAnchorElement}>
          <DropdownMenuItem onClick={handleClearScreen}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('contextmenu.chat.clear')}
          </DropdownMenuItem>
        </PositionedMenuContent>
      </DropdownMenu>
    );
  }

  if (contextMenuCategory === 'text' && contextMenuItem !== undefined) {
    const handleCopy = (): void => {
      void clipboard.writeText(contextMenuItem);
      handleContextMenuClose();
    };

    const truncated = contextMenuItem.length > 30 ? contextMenuItem.substring(0, 30) + '...' : contextMenuItem;

    return (
      <DropdownMenu open={contextMenuOpen} onOpenChange={(open) => !open && handleContextMenuClose()}>
        <PositionedMenuContent source={contextMenuPosition} anchorElement={contextMenuAnchorElement}>
          <DropdownMenuLabel className="max-w-64 truncate select-none">{truncated}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('contextmenu.text.copy')}
          </DropdownMenuItem>
        </PositionedMenuContent>
      </DropdownMenu>
    );
  }

  return null;
};
