import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentNick, useSettingsStore, resetAndGoToStart, toggleDarkMode } from '@features/settings/store/settings';
import { ChannelCategory, type ChannelList, MessageCategory, type User } from '@shared/types';
import { ircSendRawMessage, ircReconnect } from '@/network/irc/network';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { Send, Smile, User as UserIcon, MessageSquare, Moon, Sun, LogIn, LogOut } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { channelCommands, generalCommands, parseMessageToCommand } from '@/network/irc/command';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setAddMessage } from '@features/channels/store/channels';
import { setDraft, getDraft } from '@features/chat/store/drafts';
import { getUser, useUsersStore } from '@features/users/store/users';
import { MessageColor } from '@/config/theme';
import { v4 as uuidv4 } from 'uuid';
import { getChannelListSortedByAZ } from '@features/channels/store/channelList';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import { useAwayMessagesStore } from '@features/channels/store/awayMessages';
import ProfileSettings from '@features/settings/components/ProfileSettings';
import AwayMessages from '@features/channels/components/AwayMessages';
import ColorPicker from './ColorPicker';
import StylePicker from './StylePicker';
import { IRC_FORMAT } from '@/shared/lib/ircFormatting';
import type { FontFormatting } from '@features/settings/store/settings';

const Toolbar = () => {
  const { t } = useTranslation();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const nick: string = useSettingsStore((state) => state.nick);
  const currentUserAvatar: string | undefined = useSettingsStore((state) => state.currentUserAvatar);
  const currentUserFlags: string[] = useSettingsStore((state) => state.currentUserFlags);
  const isAway = currentUserFlags.includes('away');
  const isAutoAway: boolean = useSettingsStore((state) => state.isAutoAway);
  const isConnected: boolean = useSettingsStore((state) => state.isConnected);
  const fontFormatting = useSettingsStore((state) => state.fontFormatting);
  const isDarkMode = useSettingsStore((state) => state.isDarkMode);

  const awayMessages = useAwayMessagesStore((state) => state.messages);
  const awayMessagesCount = awayMessages.length;

  const [message, setMessage] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [awayDialogOpen, setAwayDialogOpen] = useState(false);
  const autocompleteMessage = useRef('');
  const autocompleteIndex = useRef(-1);
  const autocompleteInput = useRef<HTMLInputElement>(null);

  const typingStatus = useRef<'active' | 'paused' | 'done' | undefined>(undefined);

  const messageHistory = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const currentInputBeforeHistory = useRef('');
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousChannelRef = useRef<string>(currentChannelName);

  const AUTO_AWAY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

  // Apply IRC formatting codes to message based on current settings
  const applyFormatting = (text: string, formatting: FontFormatting): string => {
    let prefix = '';
    let suffix = '';

    if (formatting.bold) {
      prefix += IRC_FORMAT.BOLD;
      suffix = IRC_FORMAT.BOLD + suffix;
    }
    if (formatting.italic) {
      prefix += IRC_FORMAT.ITALIC;
      suffix = IRC_FORMAT.ITALIC + suffix;
    }
    if (formatting.underline) {
      prefix += IRC_FORMAT.UNDERLINE;
      suffix = IRC_FORMAT.UNDERLINE + suffix;
    }
    if (formatting.colorCode !== null) {
      // Use two-digit format for color codes
      const colorStr = formatting.colorCode.toString().padStart(2, '0');
      prefix += IRC_FORMAT.COLOR + colorStr;
      suffix = IRC_FORMAT.COLOR + suffix;
    }

    return prefix + text + suffix;
  };

  const commands = useMemo(() => {
    const commandsNotSorted = currentChannelCategory === ChannelCategory.channel || currentChannelCategory === ChannelCategory.priv ? generalCommands.concat(channelCommands) : generalCommands;
    return commandsNotSorted.sort((a, b) => {
      const A = a.toLowerCase();
      const B = b.toLowerCase();
      return A < B ? -1 : A > B ? 1 : 0;
    });
  }, [currentChannelCategory]);

  const channels = useMemo(() => getChannelListSortedByAZ(), []);

  const allUsers = useUsersStore((state) => state.users);
  const users = useMemo(
    () =>
      allUsers
        .filter((user: User) => user.channels.some((channel) => channel.name === currentChannelName))
        .sort((a: User, b: User) => {
          const A = a.nick.toLowerCase();
          const B = b.nick.toLowerCase();
          return A < B ? -1 : A > B ? 1 : 0;
        }),
    [allUsers, currentChannelName]
  );

  // Reset inactivity timer - called when user sends a message
  const resetInactivityTimer = (): void => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Don't start timer if already manually away (not auto-away)
    if (isAway && !isAutoAway) {
      return;
    }

    // Start new timer
    inactivityTimerRef.current = setTimeout(() => {
      const state = useSettingsStore.getState();
      // Only set away if connected and not already away
      if (state.isConnected && !state.currentUserFlags.includes('away')) {
        ircSendRawMessage(`AWAY :${t('currentUser.autoAway')}`);
        state.setIsAutoAway(true);
      }
    }, AUTO_AWAY_TIMEOUT);
  };

  // Initialize and cleanup the inactivity timer
  useEffect(() => {
    resetInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save draft when switching channels and restore draft for new channel
  useEffect(() => {
    const previousChannel = previousChannelRef.current;

    if (previousChannel !== currentChannelName) {
      // Save current message as draft for the previous channel
      setDraft(previousChannel, message);

      // Restore draft for the new channel
      const draft = getDraft(currentChannelName);
      setMessage(draft);

      // Reset history navigation when switching channels
      historyIndex.current = -1;
      currentInputBeforeHistory.current = '';

      // Update ref to current channel
      previousChannelRef.current = currentChannelName;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannelName]);

  const handleEmojiClick = (emojiData: EmojiClickData): void => {
    setMessage((prev) => prev + emojiData.emoji);
    setEmojiPickerOpen(false);
    autocompleteInput.current?.focus();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setMessage(event.target.value);

    if ([STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName)) {
      return;
    }

    if (event.target.value.length === 0 && typingStatus.current === 'active') {
      typingStatus.current = 'done';
      ircSendRawMessage(`@+draft/typing=${typingStatus.current};+typing=${typingStatus.current} TAGMSG ${currentChannelName}`);
    } else if (typingStatus.current !== 'active') {
      typingStatus.current = 'active';
      ircSendRawMessage(`@+draft/typing=${typingStatus.current};+typing=${typingStatus.current} TAGMSG ${currentChannelName}`);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (message.length === 0) {
      return;
    }

    let payload = '';
    if (message.startsWith('/')) {
      // Commands are sent without formatting
      payload = parseMessageToCommand(currentChannelName, message);
    } else {
      if (![STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName)) {
        const nick = getCurrentNick();

        // Check if any formatting is applied
        const hasFormatting =
          fontFormatting.bold ||
          fontFormatting.italic ||
          fontFormatting.underline ||
          fontFormatting.colorCode !== null;

        // Apply formatting to the message for sending
        const formattedMessage = hasFormatting ? applyFormatting(message, fontFormatting) : message;

        // Only add message locally if echo-message capability is NOT enabled
        // When echo-message is enabled, the server will echo the message back and we'll add it then
        if (!isCapabilityEnabled('echo-message')) {
          setAddMessage({
            id: uuidv4(),
            message: formattedMessage,
            nick: getUser(nick) ?? nick,
            target: currentChannelName,
            time: new Date().toISOString(),
            category: MessageCategory.default,
            color: MessageColor.default,
          });
        }

        payload = `PRIVMSG ${currentChannelName} :${formattedMessage}`;
      }
    }
    ircSendRawMessage(payload);

    if (![STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName)) {
      typingStatus.current = 'done';
      ircSendRawMessage(`@+draft/typing=${typingStatus.current};+typing=${typingStatus.current} TAGMSG ${currentChannelName}`);
    }

    // Add message to history (max 10 items)
    messageHistory.current = [message, ...messageHistory.current].slice(0, 10);
    historyIndex.current = -1;
    currentInputBeforeHistory.current = '';

    // If auto-away is active and connected, turn it off
    if (isAutoAway && isConnected) {
      ircSendRawMessage('AWAY');
      useSettingsStore.getState().setIsAutoAway(false);
    }

    // Reset the inactivity timer
    resetInactivityTimer();

    // Clear draft for current channel since message was sent
    setDraft(currentChannelName, '');

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
        setMessage(newMessage.join(' ') + ' ');

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
        setMessage(newMessage.join(' ') + ' ');

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
        setMessage(newMessage.join(' ') + ' ');

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
    <>
      <form className="px-4 flex" onSubmit={handleSubmit}>
        {currentChannelName !== DEBUG_CHANNEL && (
          <>
            {/* User Avatar with Dropdown Menu */}
            <div className="relative mr-2 mt-1 mb-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full hover:ring-2 hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    {currentUserAvatar ? (
                      <img
                        src={currentUserAvatar}
                        alt={nick}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                        {nick.substring(0, 1).toUpperCase()}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  {t('profileSettings.title')}
                </DropdownMenuItem>
                {awayMessagesCount > 0 && (
                  <DropdownMenuItem onClick={() => setAwayDialogOpen(true)}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {t('currentUser.awayMessages')}
                    <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {awayMessagesCount}
                    </span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={toggleDarkMode}>
                  {isDarkMode ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  {isDarkMode ? t('currentUser.lightMode') : t('currentUser.darkMode')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isConnected ? (
                  <DropdownMenuItem onClick={resetAndGoToStart}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('currentUser.disconnect')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => ircReconnect()}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {t('currentUser.connect')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
              </DropdownMenu>
              {isAway && (
                <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500">
                  <Moon className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              {awayMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white font-medium">
                  {awayMessagesCount > 99 ? '99+' : awayMessagesCount}
                </span>
              )}
            </div>

            <div className="flex-1 mt-1 mb-1 relative">
              <Input
                id="message-input"
                autoFocus
                value={message}
                placeholder={`${t('main.toolbar.write')} ${currentChannelName}`}
                onChange={handleChange}
                onKeyUp={handleKeyUp}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                ref={autocompleteInput}
              />
            </div>
            {message && (
              <Button className="mt-1 mb-1" type="submit" aria-label="send" variant="ghost" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            )}
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <Button className="mt-1 mb-1" type="button" aria-label="emoticons" variant="ghost" size="icon">
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </PopoverContent>
            </Popover>
            <ColorPicker open={colorPickerOpen} onOpenChange={setColorPickerOpen} />
            <StylePicker open={stylePickerOpen} onOpenChange={setStylePickerOpen} />
          </>
        )}
      </form>

      {/* Profile Settings Dialog */}
      <ProfileSettings
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        currentNick={nick}
      />

      {/* Away Messages Dialog */}
      <AwayMessages
        open={awayDialogOpen}
        onOpenChange={setAwayDialogOpen}
      />

    </>
  );
};

export default Toolbar;
