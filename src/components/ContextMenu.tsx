import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useContextMenu } from '../providers/ContextMenuContext';
import { setAddChannel } from '../store/channels';
import { ChannelCategory } from '../types';
import { getCurrentUserFlags, getMonitorLimit, getSilenceLimit, getWatchLimit, setCurrentChannelName } from '../store/settings';
import { ircSendRawMessage } from '../network/irc/network';
import { useTranslation } from 'react-i18next';
import { getUser } from '../store/users';

export const ContextMenu = () => {
  const { t } = useTranslation();
  const { contextMenuOpen, handleContextMenuClose, contextMenuAnchorElement, contextMenuCategory, contextMenuItem } = useContextMenu();

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

    const currentUserFlags = getCurrentUserFlags();
    const isRegistered = currentUserFlags.includes('r');
    const watchLimit = getWatchLimit();
    const monitorLimit = getMonitorLimit();
    const silenceLimit = getSilenceLimit();
    const canAddFriend = isRegistered && (watchLimit > 0 || monitorLimit > 0);
    const canIgnore = isRegistered && silenceLimit > 0;

    return (
      <DropdownMenu open={contextMenuOpen} onOpenChange={(open) => !open && handleContextMenuClose()}>
        <DropdownMenuContent
          style={
            contextMenuAnchorElement
              ? {
                  position: 'fixed',
                  left: `${(contextMenuAnchorElement as HTMLElement).getBoundingClientRect().left}px`,
                  top: `${(contextMenuAnchorElement as HTMLElement).getBoundingClientRect().bottom}px`,
                }
              : undefined
          }
        >
          <DropdownMenuLabel>{contextMenuItem ?? ''}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handlePriv}>{t('contextmenu.priv')}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleWhois}>{t('contextmenu.whois')}</DropdownMenuItem>
          {canAddFriend && <DropdownMenuItem onClick={handleAddFriend}>{t('contextmenu.addfriend')}</DropdownMenuItem>}
          {canIgnore && <DropdownMenuItem onClick={handleIgnore}>{t('contextmenu.ignore')}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return <></>;
};
