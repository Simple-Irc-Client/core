import React, { useEffect, useState } from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settings';
import { MessageCategory, type User } from '../types';
import { ircSendRawMessage } from '../network/network';
import { Send as SendIcon } from '@mui/icons-material';
import { parseMessageToCommand } from '../network/command';
import { DEBUG_CHANNEL } from '../config/config';
import { useChannelsStore } from '../store/channels';
import { useUsersStore } from '../store/users';

const Toolbar = (): JSX.Element => {
  const { t } = useTranslation();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const setAddMessage = useChannelsStore((state) => state.setAddMessage);
  const getUser = useUsersStore((state) => state.getUser);

  const nick: string = useSettingsStore((state) => state.nick);
  let user: User | undefined;

  useEffect(() => {
    user = getUser(nick);
  }, [nick]);

  const [message, setMessage] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setMessage(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLInputElement>): void => {
    event.preventDefault();

    if (message.length !== 0) {
      let payload = '';
      if (message.startsWith('/')) {
        payload = parseMessageToCommand(currentChannelName, message);
      } else {
        setAddMessage(currentChannelName, {
          message,
          nick: user ?? nick,
          target: currentChannelName,
          time: new Date().toISOString(),
          category: MessageCategory.default,
        });

        payload = `PRIVMSG ${currentChannelName} :${message}`;
      }
      ircSendRawMessage(payload);

      setMessage('');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ paddingLeft: '16px', paddingRight: '16px', display: 'flex', borderTop: '1px solid #eeeeee' }}>
      {currentChannelName !== DEBUG_CHANNEL && (
        <>
          <TextField
            label={`${t('main.toolbar.write')} ${currentChannelName}`}
            variant="standard"
            autoFocus
            value={message}
            sx={{ flexGrow: '1', marginBottom: '10px' }}
            onChange={handleChange}
            autoComplete="off"
          />
          <IconButton type="submit" aria-label="send">
            <SendIcon />
          </IconButton>
        </>
      )}
    </Box>
  );
};

export default Toolbar;
