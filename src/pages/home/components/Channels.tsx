import React, { useMemo, useState } from 'react';
import { List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Badge, Drawer, ListItem, IconButton, Autocomplete, TextField } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { setCurrentChannelName, useSettingsStore } from '../../../store/settings';
import { ChannelCategory, type ChannelList, type Channel } from '../../../types';
import { useTranslation } from 'react-i18next';
import { isPriv, setRemoveChannel, useChannelsStore } from '../../../store/channels';
import { channelsColor, channelsWidth, channelsTitleColor } from '../../../config/theme';
import { ircJoinChannels, ircPartChannel } from '../../../network/irc/network';
import { type BadgeProps } from '@mui/material/Badge';
import { styled } from '@mui/material/styles';
import { useChannelsDrawer } from '../../../providers/ChannelsDrawerContext';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../../config/config';
import { getChannelListSortedByAZ, useChannelListStore } from '../../../store/channelList';

const Channels = () => {
  const { t } = useTranslation();

  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const openChannelsShort = useChannelsStore((state) => state.openChannelsShortList);

  const { isChannelsDrawerOpen } = useChannelsDrawer();

  const isChannelListLoadingFinished = useChannelListStore((state) => state.finished);

  const [channelsList, setChannelsList] = useState<ChannelList[]>([]);

  useMemo(() => {
    setChannelsList(isChannelListLoadingFinished ? (getChannelListSortedByAZ() ?? []) : []);
  }, [isChannelListLoadingFinished]);

  const [joinChannel, setJoinChannel] = useState<string>('');

  const [showRemoveChannelIcon, setShowRemoveChannelIcon] = useState('');

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

  const handleJoinChannel = (): void => {
    if (joinChannel.length !== 0) {
      ircJoinChannels([joinChannel]);
      setJoinChannel('');
    }
  };

  const handleListItemClick = (channel: Channel): void => {
    setCurrentChannelName(channel.name, channel.category);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
    '& .MuiBadge-badge': {
      top: '50%',
    },
  }));

  const ChannelsList = () => (
    <List
      subheader={
        <ListSubheader component="div" sx={{ backgroundColor: { md: channelsTitleColor }, marginBottom: '1rem' }}>
          {t('main.channels.title')}
        </ListSubheader>
      }
      sx={{ minWidth: `${isChannelsDrawerOpen ? `${channelsWidth}px` : ''}`, backgroundColor: { md: channelsColor } }}
    >
      {openChannelsShort.map((channel) => (
        <ListItem
          key={channel.name}
          onMouseEnter={() => {
            handleHover(channel.name, true);
          }}
          onMouseLeave={() => {
            handleHover(channel.name, false);
          }}
          secondaryAction={
            <>
              {![DEBUG_CHANNEL, STATUS_CHANNEL].includes(channel.name) && (
                <>
                  {showRemoveChannelIcon !== channel.name && <StyledBadge badgeContent={channel.unReadMessages} showZero={false} max={99} color="primary" />}
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
                </>
              )}
            </>
          }
          disablePadding
        >
          <ListItemButton
            aria-label={channel.name}
            dense={true}
            onClick={() => {
              handleListItemClick(channel);
            }}
            selected={currentChannelName === channel.name}
          >
            <ListItemIcon sx={{ minWidth: '30px' }}>
              {channel.category === 'channel' && <TagOutlinedIcon />}
              {channel.category === 'priv' && <PersonOutlineOutlinedIcon />}
              {channel.category === 'status' && <HomeOutlinedIcon />}
              {channel.category === 'debug' && <BuildOutlinedIcon />}
              {channel.category === undefined && <TagOutlinedIcon />}
            </ListItemIcon>
            <ListItemText primary={channel.name} />
          </ListItemButton>
        </ListItem>
      ))}
      <ListItem
        secondaryAction={
          <IconButton
            edge="end"
            aria-label="add"
            onClick={() => {
              handleJoinChannel();
            }}
          >
            <AddOutlinedIcon />
          </IconButton>
        }
      >
        <Autocomplete
          value={joinChannel}
          size="small"
          options={channelsList.map((option) => option.name)}
          getOptionDisabled={(option) =>
            openChannelsShort
              .map((channel) => {
                return channel.name;
              })
              .includes(option)
          }
          freeSolo
          onChange={(event, newValue) => {
            if (newValue != null) {
              setJoinChannel(newValue);
            }
          }}
          renderInput={(params) => <TextField {...params} variant="standard" />}
          sx={{ width: '100%' }}
        />
      </ListItem>
    </List>
  );

  return (
    <Drawer
      variant="persistent"
      sx={{
        overflowY: 'scroll',
        minWidth: `${isChannelsDrawerOpen ? `${channelsWidth}px` : ''}`,
        '& .MuiDrawer-paper': { backgroundColor: { md: channelsColor } },
      }}
      open={isChannelsDrawerOpen}
    >
      <ChannelsList />
    </Drawer>
  );
};

export default Channels;
