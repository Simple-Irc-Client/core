import React from 'react';
import { List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Badge, Drawer } from '@mui/material';
import { TagOutlined as TagOutlinedIcon, HomeOutlined as HomeOutlinedIcon, BuildOutlined as BuildOutlinedIcon, PersonOutlineOutlined as PersonOutlineOutlinedIcon } from '@mui/icons-material';
import { useSettingsStore } from '../store/settings';
import { type Channel } from '../types';
import { useTranslation } from 'react-i18next';
import { useChannelsStore } from '../store/channels';
import { channelsColor, channelsWidth, channelsTitleColor } from '../config';

const Channels = (): JSX.Element => {
  const { t } = useTranslation();

  const openChannels: Channel[] = useChannelsStore((state) => state.openChannels);
  const setCurrentChannelName = useSettingsStore((state) => state.setCurrentChannelName);

  const handleListItemClick = (channel: Channel): void => {
    setCurrentChannelName(channel.name, channel.category);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: channelsWidth, backgroundColor: { md: channelsColor } },
      }}
      open
    >
      <List
        subheader={
          <ListSubheader component="div" sx={{ backgroundColor: { md: channelsTitleColor }, marginBottom: '1rem' }}>
            {t('main.channels.title')}
          </ListSubheader>
        }
        sx={{ minWidth: channelsWidth, backgroundColor: { md: channelsColor } }}
      >
        {openChannels.map((channel) => (
          <ListItemButton
            key={channel.name}
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
        ))}
      </List>
    </Drawer>
  );
};

export default Channels;
