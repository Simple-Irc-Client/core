import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settings';
import { ChannelCategory, MessageCategory, type User } from '../types';
import { ircSendRawMessage } from '../network/network';
import { Send as SendIcon } from '@mui/icons-material';
import { channelCommands, generalCommands, parseMessageToCommand } from '../network/command';
import { DEBUG_CHANNEL } from '../config/config';
import { useChannelsStore } from '../store/channels';
import { useUsersStore } from '../store/users';
import { MessageColor } from '../config/theme';
import { useChannelListStore } from '../store/channelsList';

const Toolbar = (): JSX.Element => {
  const { t } = useTranslation();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const setAddMessage = useChannelsStore((state) => state.setAddMessage);
  const getUser = useUsersStore((state) => state.getUser);

  const nick: string = useSettingsStore((state) => state.nick);
  let user: User | undefined;

  useEffect(() => {
    user = getUser(nick);
  }, [nick]);

  const [message, setMessage] = useState('');
  const autocompleteMessage = useRef('');
  const autocompleteIndex = useRef(-1);
  const autocompleteInput = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setMessage(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLInputElement>): void => {
    event.preventDefault();

    if (message.length === 0) {
      return;
    }

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
        color: MessageColor.default,
      });

      payload = `PRIVMSG ${currentChannelName} :${message}`;
    }
    ircSendRawMessage(payload);

    setMessage('');
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'Tab':
        return;
      // case 'Up':
      // case 'ArrowUp':
      //   return;
      // case 'Down':
      // case 'ArrowDown':
      //   return;
      default:
        autocompleteMessage.current = autocompleteInput.current?.value ?? '';
        break;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'Tab': {
        event.preventDefault();
        const word = autocompleteMessage.current.split(' ').pop()?.toLowerCase();
        if (word !== undefined && word?.length !== 0) {
          if (word.startsWith('/')) {
            // autocomplete commands
            const commands = ([ChannelCategory.channel, ChannelCategory.priv].includes(currentChannelCategory) ? generalCommands.concat(channelCommands) : generalCommands).sort((a, b) => {
              const A = a.toLowerCase();
              const B = b.toLowerCase();
              return A < B ? -1 : A > B ? 1 : 0;
            });

            for (const [index, command] of commands.entries()) {
              if (command.toLowerCase().startsWith(word) && index > autocompleteIndex.current) {
                autocompleteIndex.current = index;

                const newMessage = autocompleteMessage.current.split(' ');
                newMessage.pop();
                newMessage.push(command);
                setMessage(newMessage.join(' '));

                return;
              }
            }
            autocompleteIndex.current = -1; // clear index if its last complete
          } else if (word.startsWith('#')) {
            // autocomplete channel name
            const channels = useChannelListStore.getState().channels.sort((a, b) => {
              const A = a.name.toLowerCase();
              const B = b.name.toLowerCase();
              return A < B ? -1 : A > B ? 1 : 0;
            });

            for (const [index, channel] of channels.entries()) {
              if (channel.name.toLowerCase().startsWith(word) && index > autocompleteIndex.current) {
                autocompleteIndex.current = index;

                const newMessage = autocompleteMessage.current.split(' ');
                newMessage.pop();
                newMessage.push(channel.name);
                setMessage(newMessage.join(' '));

                return;
              }
            }
            autocompleteIndex.current = -1; // clear index if its last complete
          } else {
            // autocomplete users
            const users = useUsersStore
              .getState()
              .getUsersFromChannel(currentChannelName)
              .sort((a, b) => {
                const A = a.nick.toLowerCase();
                const B = b.nick.toLowerCase();
                return A < B ? -1 : A > B ? 1 : 0;
              });

            for (const [index, user] of users.entries()) {
              if (user.nick.toLowerCase().startsWith(word) && index > autocompleteIndex.current) {
                autocompleteIndex.current = index;

                const newMessage = autocompleteMessage.current.split(' ');
                newMessage.pop();
                newMessage.push(user.nick);
                setMessage(newMessage.join(' '));

                return;
              }
            }
            autocompleteIndex.current = -1; // clear index if its last complete
          }
        }
        break;
      }
      // case 'Up':
      // case 'ArrowUp':
      //   event.preventDefault();
      //   break;
      // case 'Down':
      // case 'ArrowDown':
      //   event.preventDefault();
      //   break;
      default:
        autocompleteIndex.current = -1;
        break;
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
            onKeyUp={handleKeyUp}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            inputRef={autocompleteInput}
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
