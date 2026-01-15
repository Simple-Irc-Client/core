import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentNick, useSettingsStore } from '../../../store/settings';
import { ChannelCategory, type ChannelList, MessageCategory, type User } from '../../../types';
import { ircSendRawMessage } from '../../../network/irc/network';
import { Send } from 'lucide-react';
import { channelCommands, generalCommands, parseMessageToCommand } from '../../../network/irc/command';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../../config/config';
import { setAddMessage } from '../../../store/channels';
import { getUser, getUsersFromChannelSortedByAZ } from '../../../store/users';
import { MessageColor } from '../../../config/theme';
import { v4 as uuidv4 } from 'uuid';
import { getChannelListSortedByAZ } from '../../../store/channelList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Toolbar = () => {
  const { t } = useTranslation();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);

  const [message, setMessage] = useState('');
  const autocompleteMessage = useRef('');
  const autocompleteIndex = useRef(-1);
  const autocompleteInput = useRef<HTMLInputElement>(null);

  const typingStatus = useRef<'active' | 'paused' | 'done' | undefined>(undefined);

  const messageHistory = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const currentInputBeforeHistory = useRef('');

  const commands = useMemo(() => {
    const commandsNotSorted = currentChannelCategory === ChannelCategory.channel || currentChannelCategory === ChannelCategory.priv ? generalCommands.concat(channelCommands) : generalCommands;
    return commandsNotSorted.sort((a, b) => {
      const A = a.toLowerCase();
      const B = b.toLowerCase();
      return A < B ? -1 : A > B ? 1 : 0;
    });
  }, [currentChannelCategory]);

  const channels = useMemo(() => getChannelListSortedByAZ(), []);

  const users = useMemo(() => getUsersFromChannelSortedByAZ(currentChannelName), [currentChannelName]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setMessage(event.target.value);

    if (typingStatus.current !== 'active' && ![STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName)) {
      typingStatus.current = 'active';
      ircSendRawMessage(`@+draft/typing=${typingStatus.current};+typing=${typingStatus.current} TAGMSG ${currentChannelName}`, true);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (message.length === 0) {
      return;
    }

    let payload = '';
    if (message.startsWith('/')) {
      payload = parseMessageToCommand(currentChannelName, message);
    } else {
      if (![STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName)) {
        const nick = getCurrentNick();

        setAddMessage({
          id: uuidv4(),
          message,
          nick: getUser(nick) ?? nick,
          target: currentChannelName,
          time: new Date().toISOString(),
          category: MessageCategory.default,
          color: MessageColor.default,
        });

        payload = `PRIVMSG ${currentChannelName} :${message}`;
      }
    }
    ircSendRawMessage(payload);

    if (![STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName)) {
      typingStatus.current = 'done';
      ircSendRawMessage(`@+draft/typing=${typingStatus.current};+typing=${typingStatus.current} TAGMSG ${currentChannelName}`, true);
    }

    // Add message to history (max 10 items)
    messageHistory.current = [message, ...messageHistory.current].slice(0, 10);
    historyIndex.current = -1;
    currentInputBeforeHistory.current = '';

    setMessage('');
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'Tab':
      case 'Up':
      case 'ArrowUp':
      case 'Down':
      case 'ArrowDown':
        return;
      default:
        autocompleteMessage.current = autocompleteInput.current?.value ?? '';
        break;
    }
  };

  const autocompleteCommands = (word: string, commands: string[]): boolean => {
    for (const [index, command] of commands.entries()) {
      if (command.toLowerCase().startsWith(word) && index > autocompleteIndex.current) {
        autocompleteIndex.current = index;

        const newMessage = autocompleteMessage.current.split(' ');
        newMessage.pop();
        newMessage.push(command);
        setMessage(newMessage.join(' '));

        return true;
      }
    }
    return false;
  };

  const autocompleteChannels = (word: string, channels: ChannelList[]): boolean => {
    for (const [index, channel] of channels.entries()) {
      if (channel.name.toLowerCase().startsWith(word) && index > autocompleteIndex.current) {
        autocompleteIndex.current = index;

        const newMessage = autocompleteMessage.current.split(' ');
        newMessage.pop();
        newMessage.push(channel.name);
        setMessage(newMessage.join(' '));

        return true;
      }
    }
    return false;
  };

  const autocompleteUsers = (word: string, users: User[]): boolean => {
    for (const [index, user] of users.entries()) {
      if (user.nick.toLowerCase().startsWith(word) && index > autocompleteIndex.current) {
        autocompleteIndex.current = index;

        const newMessage = autocompleteMessage.current.split(' ');
        newMessage.pop();
        newMessage.push(user.nick);
        setMessage(newMessage.join(' '));

        return true;
      }
    }
    return false;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'Tab': {
        event.preventDefault();
        const word = autocompleteMessage.current.split(' ').pop()?.toLowerCase();
        if (word !== undefined && word?.length !== 0) {
          if (word.startsWith('/')) {
            // autocomplete commands
            const done = autocompleteCommands(word, commands);
            if (done) {
              return;
            }
            autocompleteIndex.current = -1; // clear index if its last complete
            autocompleteCommands(word, commands);
          } else if (word.startsWith('#')) {
            // autocomplete channel name
            const done = autocompleteChannels(word, channels);
            if (done) {
              return;
            }
            autocompleteIndex.current = -1; // clear index if its last complete
            autocompleteChannels(word, channels);
          } else {
            // autocomplete users
            const done = autocompleteUsers(word, users);
            if (done) {
              return;
            }
            autocompleteIndex.current = -1; // clear index if its last complete
            autocompleteUsers(word, users);
          }
        }
        break;
      }
      case 'Up':
      case 'ArrowUp': {
        event.preventDefault();
        if (messageHistory.current.length === 0) {
          return;
        }
        // Save current input when starting to browse history
        if (historyIndex.current === -1) {
          currentInputBeforeHistory.current = message;
        }
        // Move up in history (older messages)
        if (historyIndex.current < messageHistory.current.length - 1) {
          historyIndex.current += 1;
          const historyMessage = messageHistory.current[historyIndex.current];
          if (historyMessage !== undefined) {
            setMessage(historyMessage);
          }
        }
        break;
      }
      case 'Down':
      case 'ArrowDown': {
        event.preventDefault();
        if (historyIndex.current === -1) {
          return;
        }
        // Move down in history (newer messages)
        historyIndex.current -= 1;
        if (historyIndex.current === -1) {
          // Restore original input
          setMessage(currentInputBeforeHistory.current);
        } else {
          const historyMessage = messageHistory.current[historyIndex.current];
          if (historyMessage !== undefined) {
            setMessage(historyMessage);
          }
        }
        break;
      }
      default:
        autocompleteIndex.current = -1;
        break;
    }
  };

  return (
    <form className="px-4 flex" onSubmit={handleSubmit}>
      {currentChannelName !== DEBUG_CHANNEL && (
        <>
          <div className="flex-1 mt-1 mb-1 relative">
            <label htmlFor="message-input" className="absolute -top-5 left-0 text-xs text-gray-600">
              {`${t('main.toolbar.write')} ${currentChannelName}`}
            </label>
            <Input
              id="message-input"
              autoFocus
              value={message}
              onChange={handleChange}
              onKeyUp={handleKeyUp}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              ref={autocompleteInput}
              className="px-0"
            />
          </div>
          {message && (
            <Button className="mt-1 mb-1" type="submit" aria-label="send" variant="ghost" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </form>
  );
};

export default Toolbar;
