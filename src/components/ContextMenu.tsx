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
import { setCurrentChannelName } from '../store/settings';
import { ircSendRawMessage } from '../network/irc/network';

export const ContextMenu = () => {
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
          <DropdownMenuItem onClick={handlePriv}>Priv</DropdownMenuItem>
          <DropdownMenuItem onClick={handleWhois}>Whois</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return <></>;
};
