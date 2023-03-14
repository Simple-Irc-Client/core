import React from 'react';
import { Divider, Menu, MenuItem } from '@mui/material';
import { useContextMenu } from '../providers/ContextMenuContext';
import { setAddChannel } from '../store/channels';
import { ChannelCategory } from '../types';
import { setCurrentChannelName } from '../store/settings';
import { ircSendRawMessage } from '../network/network';

export const ContextMenu = (): JSX.Element => {
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
      <Menu
        open={contextMenuOpen}
        onClose={handleContextMenuClose}
        anchorEl={contextMenuAnchorElement}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        <MenuItem disabled>{contextMenuItem ?? ''}</MenuItem>
        <Divider />
        <MenuItem onClick={handlePriv}>Priv</MenuItem>
        <MenuItem onClick={handleWhois}>Whois</MenuItem>
      </Menu>
    );
  }
  return <></>;
};
