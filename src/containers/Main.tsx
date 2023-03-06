import React, { useEffect, useRef } from 'react';
import { Avatar, Box, List, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import { useChannelsStore } from '../store/channels';
import { useSettingsStore } from '../store/settings';
import { MessageCategory, type Message } from '../types';
import { format } from 'date-fns';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../config/config';
import { MessageColor } from '../config/theme';

const MainViewDebug = ({ message }: { message: Message }): JSX.Element => (
  <ListItem>
    <ListItemText>
      <code>
        <span style={{ color: MessageColor.time }}>{format(new Date(message.time), 'HH:mm:ss')}</span>
        &nbsp;
        {message?.nick !== undefined && <>&lt;{typeof message.nick === 'string' ? message.nick : message.nick.nick}&gt;&nbsp;</>}
        <span style={{ color: message.color ?? MessageColor.default }}>{message.message}</span>
      </code>
    </ListItemText>
  </ListItem>
);

const MainViewClassic = ({ message }: { message: Message }): JSX.Element => (
  <ListItem>
    <ListItemText>
      <span style={{ color: MessageColor.time }}>{format(new Date(message.time), 'HH:mm')}</span>
      &nbsp; &lt;
      {message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : ''}
      &gt; &nbsp;
      <span style={{ color: message.color ?? MessageColor.default }}>{message.message}</span>
    </ListItemText>
  </ListItem>
);

const MainViewModern = ({ message }: { message: Message }): JSX.Element => (
  <>
    {message.category !== MessageCategory.default && (
      <>
        <ListItem>
          <ListItemText sx={{ color: message.color ?? MessageColor.default }}>{message.message}</ListItemText>
        </ListItem>
      </>
    )}
    {message.category === MessageCategory.default && (
      <>
        <ListItem alignItems="flex-start">
          <ListItemAvatar>
            <Avatar
              alt={message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : ''}
              src={message?.nick !== undefined ? (typeof message.nick === 'string' ? undefined : message.nick.avatar) : undefined}
            >
              {message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick.substring(0, 1) : message.nick.nick.substring(0, 1)) : ''}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            disableTypography={true}
            primary={
              <React.Fragment>
                <Typography component="div" sx={{ display: 'flex' }}>
                  <Typography
                    component="div"
                    variant="body2"
                    sx={{ minWidth: 'fit-content', color: message?.nick !== undefined ? (typeof message.nick === 'string' ? 'inherit' : message.nick.color) : 'inherit' }}
                  >
                    {message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : ''}
                  </Typography>
                  <Box sx={{ flexGrow: 1, width: '100%' }} />
                  <Typography component="div" variant="body2" sx={{ color: MessageColor.time }}>
                    {format(new Date(message.time), 'HH:mm')}
                  </Typography>
                </Typography>
              </React.Fragment>
            }
            secondary={
              <React.Fragment>
                <Typography component="div" variant="body2" color="text.primary" sx={{ color: message.color ?? MessageColor.default }}>
                  {message.message}
                </Typography>
              </React.Fragment>
            }
          />
        </ListItem>
      </>
    )}
  </>
);

const Main = (): JSX.Element => {
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const theme: string = useSettingsStore((state) => state.theme);
  const channelsStore = useChannelsStore();

  const AlwaysScrollToBottom = (): JSX.Element => {
    const elementRef = useRef<HTMLDivElement>(null);
    useEffect(() => elementRef.current?.scrollIntoView());
    return <div ref={elementRef} />;
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'scroll', position: 'relative' }}>
      {channelsStore.getMessages(currentChannelName).map((message, index) => (
        <List key={`message-${index}`} dense={true} sx={{ paddingTop: '0', paddingBottom: '0' }}>
          {[DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && <MainViewDebug message={message} />}
          {![DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && (
            <>
              {theme === 'classic' && <MainViewClassic message={message} />}
              {theme === 'modern' && <MainViewModern message={message} />}
            </>
          )}
        </List>
      ))}
      <AlwaysScrollToBottom />
    </Box>
  );
};

export default Main;
