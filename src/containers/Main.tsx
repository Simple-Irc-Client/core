import React, { useEffect, useRef } from 'react';
import { Avatar, Box, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import { useSettingsStore } from '../store/settings';
import { MessageCategory, type Message } from '../types';
import { format } from 'date-fns';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../config/config';
import { MessageColor } from '../config/theme';
import { useCurrentStore } from '../store/current';

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

const MainViewModern = ({ message, lastNick }: { message: Message; lastNick: string }): JSX.Element => {
  const nick = message.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : '';
  const avatar = message?.nick !== undefined ? (typeof message.nick === 'string' ? undefined : message.nick.avatar) : undefined;
  const avatarLetter = message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick.substring(0, 1) : message.nick.nick.substring(0, 1)) : '';
  const nickColor = message?.nick !== undefined ? (typeof message.nick === 'string' ? 'inherit' : message.nick.color) : 'inherit';

  return (
    <>
      {message.category !== MessageCategory.default && (
        <>
          <ListItem>
            <ListItemText sx={{ paddingLeft: '56px', color: message.color ?? MessageColor.default }}>{message.message}</ListItemText>
          </ListItem>
        </>
      )}
      {message.category === MessageCategory.default && (
        <>
          <ListItem alignItems="flex-start" sx={{ paddingTop: lastNick === nick ? '0' : '', paddingBottom: lastNick === nick ? '0' : '' }}>
            <ListItemAvatar>
              {lastNick !== nick && (
                <Avatar alt={nick} src={avatar}>
                  {avatarLetter}
                </Avatar>
              )}
            </ListItemAvatar>
            <ListItemText
              disableTypography={true}
              primary={
                lastNick !== nick ? (
                  <>
                    <Box sx={{ display: 'flex' }}>
                      <Box sx={{ color: nickColor }}>{nick}</Box>
                      <Box sx={{ flexGrow: 1 }} />
                      <Box sx={{ color: MessageColor.time, fontSize: '12px', minWidth: 'fit-content' }}>{format(new Date(message.time), 'HH:mm')}</Box>
                    </Box>
                  </>
                ) : undefined
              }
              secondary={
                <>
                  <Box sx={{ color: message.color ?? MessageColor.default }}>
                    {lastNick !== nick && <Box sx={{ fontSize: '14px' }}>{message.message}</Box>}
                    {lastNick === nick && (
                      <Box sx={{ display: 'flex' }}>
                        <Box sx={{ fontSize: '14px' }}>{message.message}</Box>
                        <Box sx={{ flexGrow: 1 }} />
                        <Box sx={{ color: MessageColor.time, fontSize: '12px', minWidth: 'fit-content' }}>{format(new Date(message.time), 'HH:mm')}</Box>
                      </Box>
                    )}
                  </Box>
                </>
              }
            />
          </ListItem>
        </>
      )}
    </>
  );
};

const Main = (): JSX.Element => {
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const theme: string = useSettingsStore((state) => state.theme);
  const messages = useCurrentStore((state) => state.messages);

  let lastNick = '';

  const AlwaysScrollToBottom = (): JSX.Element => {
    const elementRef = useRef<HTMLDivElement>(null);
    useEffect(() => elementRef.current?.scrollIntoView());
    return <div ref={elementRef} />;
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'scroll', position: 'relative', overflowWrap: 'anywhere' }}>
      <List dense={true} sx={{ paddingTop: '0', paddingBottom: '0' }}>
        {messages.map((message) => {
          const mainWindow = (
            <React.Fragment key={`message-${message.id}`}>
              {[DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && <MainViewDebug message={message} />}
              {![DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && (
                <>
                  {theme === 'classic' && <MainViewClassic message={message} />}
                  {theme === 'modern' && <MainViewModern message={message} lastNick={lastNick} />}
                </>
              )}
            </React.Fragment>
          );
          lastNick = message.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : '';
          return mainWindow;
        })}
        <AlwaysScrollToBottom />
      </List>
    </Box>
  );
};

export default Main;
