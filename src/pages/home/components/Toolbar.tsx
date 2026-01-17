import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentNick, useSettingsStore } from '../../../store/settings';
import { ChannelCategory, type ChannelList, MessageCategory, type User } from '../../../types';
import { ircSendRawMessage } from '../../../network/irc/network';
import { Send, Smile, User as UserIcon, MessageSquare } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { channelCommands, generalCommands, parseMessageToCommand } from '../../../network/irc/command';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../../config/config';
import { setAddMessage } from '../../../store/channels';
import { getUser, getUsersFromChannelSortedByAZ } from '../../../store/users';
import { MessageColor } from '../../../config/theme';
import { v4 as uuidv4 } from 'uuid';
import { getChannelListSortedByAZ } from '../../../store/channelList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAwayMessagesStore, clearAwayMessages } from '../../../store/awayMessages';
import { Label } from '@/components/ui/label';

const Toolbar = () => {
  const { t } = useTranslation();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const nick: string = useSettingsStore((state) => state.nick);
  const currentUserFlags: string[] = useSettingsStore((state) => state.currentUserFlags);
  const isAway = currentUserFlags.includes('away');

  const awayMessages = useAwayMessagesStore((state) => state.messages);
  const awayMessagesCount = awayMessages.length;

  const [message, setMessage] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [awayDialogOpen, setAwayDialogOpen] = useState(false);
  const [newNick, setNewNick] = useState('');
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

  const handleEmojiClick = (emojiData: EmojiClickData): void => {
    setMessage((prev) => prev + emojiData.emoji);
    setEmojiPickerOpen(false);
    autocompleteInput.current?.focus();
  };

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

  const handleNickChange = (): void => {
    if (newNick.trim().length > 0) {
      ircSendRawMessage(`NICK ${newNick.trim()}`);
      setProfileDialogOpen(false);
      setNewNick('');
    }
  };

  const handleOpenAwayDialog = (): void => {
    setAwayDialogOpen(true);
  };

  const handleCloseAwayDialog = (): void => {
    clearAwayMessages();
    setAwayDialogOpen(false);
  };

  const handleOpenProfileDialog = (): void => {
    setNewNick(nick);
    setProfileDialogOpen(true);
  };

  return (
    <>
      <form className="px-4 flex" onSubmit={handleSubmit}>
        {currentChannelName !== DEBUG_CHANNEL && (
          <>
            {/* User Avatar with Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full mr-2 mt-1 mb-1 hover:ring-2 hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200">
                    {nick.substring(0, 1).toUpperCase()}
                  </span>
                  {isAway && awayMessagesCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white font-medium">
                      {awayMessagesCount > 99 ? '99+' : awayMessagesCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleOpenProfileDialog}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  {t('main.toolbar.profileSettings')}
                </DropdownMenuItem>
                {isAway && (
                  <DropdownMenuItem onClick={handleOpenAwayDialog}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {t('main.toolbar.awayMessages')}
                    {awayMessagesCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {awayMessagesCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

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
          </>
        )}
      </form>

      {/* Profile Settings Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('main.toolbar.profileSettings')}</DialogTitle>
            <DialogDescription>{t('main.toolbar.profileDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nick" className="text-right">
                {t('main.toolbar.nick')}
              </Label>
              <Input
                id="nick"
                value={newNick}
                onChange={(e) => setNewNick(e.target.value)}
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNickChange();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleNickChange}>
              {t('main.toolbar.changeNick')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Away Messages Dialog */}
      <Dialog open={awayDialogOpen} onOpenChange={(open) => !open && handleCloseAwayDialog()}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('main.toolbar.awayMessages')}</DialogTitle>
            <DialogDescription>{t('main.toolbar.awayMessagesDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {awayMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">{t('main.toolbar.noAwayMessages')}</p>
            ) : (
              <div className="space-y-3">
                {awayMessages.map((msg) => (
                  <div key={msg.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-medium">{msg.channel}</span>
                      <span>{new Date(msg.time).toLocaleString()}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">{typeof msg.nick === 'string' ? msg.nick : msg.nick?.nick}:</span>{' '}
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleCloseAwayDialog}>
              {t('main.toolbar.markAsRead')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Toolbar;
