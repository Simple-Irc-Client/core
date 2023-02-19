import React, { useState } from 'react';
import { List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Badge, Drawer, ListItem, IconButton } from '@mui/material';
import {
  TagOutlined as TagOutlinedIcon,
  HomeOutlined as HomeOutlinedIcon,
  BuildOutlined as BuildOutlinedIcon,
  PersonOutlineOutlined as PersonOutlineOutlinedIcon,
  CloseOutlined as CloseOutlinedIcon,
} from '@mui/icons-material';
import { useSettingsStore } from '../store/settings';
import { ChannelCategory, type Channel } from '../types';
import { useTranslation } from 'react-i18next';
import { useChannelsStore } from '../store/channels';
import { channelsColor, channelsWidth, channelsTitleColor } from '../config';
import { ircPartChannel } from '../network/network';

const Channels = (): JSX.Element => {
  const { t } = useTranslation();

  const openChannels: Channel[] = useChannelsStore((state) => state.openChannels);
  const setCurrentChannelName = useSettingsStore((state) => state.setCurrentChannelName);

  const [showRemoveChannelIcon, setShowRemoveChannelIcon] = useState('');

  const handleHover = (channel: string, visible: boolean): void => {
    if (visible) {
      setShowRemoveChannelIcon(channel);
    } else {
      setShowRemoveChannelIcon('');
    }
  };

  const handleRemoveChannel = (channel: Channel): void => {
    ircPartChannel(channel.name);
  };

  const handleListItemClick = (channel: Channel): void => {
    setCurrentChannelName(channel.name, channel.category);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        '& .MuiDrawer-paper': { boxSizing: 'border-box', backgroundColor: { md: channelsColor } },
      }}
      open
    >
      <List
        subheader={
          <ListSubheader component="div" sx={{ backgroundColor: { md: channelsTitleColor }, marginBottom: '1rem' }}>
            {t('main.channels.title')}
          </ListSubheader>
        }
        sx={{ minWidth: `${channelsWidth}px`, backgroundColor: { md: channelsColor } }}
      >
        {openChannels.map((channel) => (
          <ListItem
            key={channel.name}
            onMouseEnter={() => {
              handleHover(channel.name, true);
            }}
            onMouseLeave={() => {
              handleHover(channel.name, false);
            }}
            secondaryAction={
              <IconButton
                edge="end"
                aria-label="close"
                sx={{ display: [ChannelCategory.channel, ChannelCategory.priv].includes(channel.category) ? (showRemoveChannelIcon === channel.name ? 'inherit' : 'none') : 'none' }}
                onClick={() => {
                  handleRemoveChannel(channel);
                }}
              >
                <CloseOutlinedIcon />
              </IconButton>
            }
            disablePadding
          >
            <ListItemButton
              aria-label={channel.name}
              dense={true}
              onClick={() => {
                handleListItemClick(channel);
              }}
            >
              <Badge badgeContent={channel.unReadMessages} showZero={false} max={99} color="primary" sx={{ top: '50%' }}>
                <ListItemIcon sx={{ minWidth: '30px' }}>
                  {channel.category === 'channel' && <TagOutlinedIcon />}
                  {channel.category === 'priv' && <PersonOutlineOutlinedIcon />}
                  {channel.category === 'status' && <HomeOutlinedIcon />}
                  {channel.category === 'debug' && <BuildOutlinedIcon />}
                  {channel.category === undefined && <TagOutlinedIcon />}
                </ListItemIcon>
                <ListItemText primary={channel.name} />
              </Badge>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};

export default Channels;
