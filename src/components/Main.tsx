import React, { useEffect, useRef, useState } from 'react';
import { Avatar, Box, List, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import { useChannelsStore } from '../store/channels';
import { useSettingsStore } from '../store/settings';
import { type Message } from '../types';
import { format } from 'date-fns';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../config';

const MainViewDebug = ({ message }: { message: Message }): JSX.Element => (
  <ListItem>
    <ListItemText>
      <code>
        {format(new Date(message.time), 'HH:mm:ss')}
        &nbsp;
        {message?.nick !== undefined && <>&lt;{typeof message.nick === 'string' ? message.nick : message.nick.nick}&gt;&nbsp;</>}
        {message.message}
      </code>
    </ListItemText>
  </ListItem>
);

const MainViewClassic = ({ message }: { message: Message }): JSX.Element => (
  <ListItem>
    <ListItemText>
      {format(new Date(message.time), 'HH:mm')}
      &nbsp; &lt;
      {message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : ''}
      &gt; &nbsp;
      {message.message}
    </ListItemText>
  </ListItem>
);

const MainViewModern = ({ message }: { message: Message }): JSX.Element => (
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
            <Typography component="div" variant="body2">
              {format(new Date(message.time), 'HH:mm')}
            </Typography>
          </Typography>
        </React.Fragment>
      }
      secondary={
        <React.Fragment>
          <Typography component="div" variant="body2" color="text.primary">
            {message.message}
          </Typography>
        </React.Fragment>
      }
    />
  </ListItem>
);

const Main = (): JSX.Element => {
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const theme: string = useSettingsStore((state) => state.theme);

  const channelsStore = useChannelsStore();

  const [messages, updateMessages] = useState<Message[]>([]);

  useEffect(() => {
    updateMessages(channelsStore.getMessages(currentChannelName));
  }, [currentChannelName, channelsStore.getMessages(currentChannelName).length]);

  const AlwaysScrollToBottom = (): JSX.Element => {
    const elementRef = useRef<HTMLDivElement>(null);
    useEffect(() => elementRef.current?.scrollIntoView());
    return <div ref={elementRef} />;
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'scroll' }}>
      {messages.map((message, index) => (
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
