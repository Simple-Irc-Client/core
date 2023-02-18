import React, { useState } from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settings';
import { ChannelCategory } from '../types';
import { ircSendRawMessage } from '../network/network';
import { Send as SendIcon } from '@mui/icons-material';
import { parseMessageToCommand } from '../network/command';

const Toolbar = (): JSX.Element => {
  const { t } = useTranslation();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);

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
        // TODO show message
        payload = `PRIVMSG ${currentChannelName} :${message}`;
      }
      ircSendRawMessage(payload);

      setMessage('');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ paddingLeft: '16px', paddingRight: '16px', display: 'flex', borderTop: '1px solid #eeeeee' }}>
      <TextField
        label={currentChannelCategory === ChannelCategory.priv ? `${t('main.toolbar.write.person')} ${currentChannelName}` : `${t('main.toolbar.write.channel')} ${currentChannelName}`}
        variant="standard"
        autoFocus
        value={message}
        sx={{ flexGrow: '1', marginBottom: '10px' }}
        onChange={handleChange}
      />
      <IconButton type="submit" aria-label="send">
        <SendIcon />
      </IconButton>
    </Box>
  );
};

export default Toolbar;
