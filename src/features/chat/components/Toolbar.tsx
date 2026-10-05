import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentNick, isSameName, useSettingsStore, resetAndGoToStart, changeServer, toggleDarkMode } from '@features/settings/store/settings';
import { ChannelCategory, MessageCategory, type User } from '@shared/types';
import { ircSendCommand, ircSendRawMessage, ircReconnect } from '@/network/irc/network';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { Send, Smile, User as UserIcon, MessageSquare, Moon, Sun, LogIn, LogOut, ArrowLeftRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { channelCommands, generalCommands, parseMessageToCommand } from '@/network/irc/command';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setAddMessage, setUpdateMessage } from '@features/channels/store/channels';
import { BodyKind } from '@features/e2ee/protocol';
import { sendEncrypted } from '@features/e2ee/session';
import { isSessionActive } from '@features/e2ee/store/e2ee';
import { setDraft, getDraft } from '@features/chat/store/drafts';
import { getUser, useUsersStore } from '@features/users/store/users';
import { MessageColor } from '@/config/theme';
import { v4 as uuidv4 } from 'uuid';
import { getChannelListSortedByAZ } from '@features/channels/store/channelList';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import type { EmojiClickData } from 'emoji-picker-react';

const EmojiPicker = lazy(() => import('emoji-picker-react'));
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

// eslint-disable-next-line no-control-regex
const ACTION_BODY = /^\x01ACTION (.*)\x01$/;
// Case-insensitive so a hand-typed lowercase `/quote privmsg` can't slip past the E2EE gate as plaintext
const PRIVMSG_OR_NOTICE = /^(PRIVMSG|NOTICE) (\S+) :([\s\S]*)$/i;

export type OutgoingCommandGate =
  | { verdict: 'encrypt'; target: string; kind: BodyKind; body: string }
  | { verdict: 'block'; target: string };

/**
 * Gates a command's wire line (not its name, so every command producing PRIVMSG/NOTICE is covered)
 * addressed to a peer with an active E2EE session: PRIVMSG is encrypted, NOTICE is blocked since it
 * has no encrypted form. Callers must send to the returned `target`, not the open window.
 */
export const gateOutgoingCommand = (payload: string): OutgoingCommandGate | null => {
  if (payload.includes('\n')) {
    return null;
  }

  const match = PRIVMSG_OR_NOTICE.exec(payload);
  if (!match) {
    return null;
  }

  const verb = (match[1] ?? '').toUpperCase();
  const target = match[2] ?? '';
  const body = match[3] ?? '';
  if (!isSessionActive(target)) {
    return null;
  }

  if (verb === 'NOTICE') {
    return { verdict: 'block', target };
  }

  const action = ACTION_BODY.exec(body);
  return action
    ? { verdict: 'encrypt', target, kind: BodyKind.action, body: action[1] ?? '' }
    : { verdict: 'encrypt', target, kind: BodyKind.message, body };
};

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
  const isConnecting: boolean = useSettingsStore((state) => state.isConnecting);
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
        .filter((user: User) => user.channels.some((channel) => isSameName(channel.name, currentChannelName)))
        .sort((a: User, b: User) => {
          const A = a.nick.toLowerCase();
          const B = b.nick.toLowerCase();
          return A < B ? -1 : A > B ? 1 : 0;
        }),
    [allUsers, currentChannelName]
  );

  const resetInactivityTimer = (): void => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (isAway && !isAutoAway) {
      return;
    }

    inactivityTimerRef.current = setTimeout(() => {
      const state = useSettingsStore.getState();
      if (state.isConnected && !state.currentUserFlags.includes('away')) {
        ircSendRawMessage(`AWAY :${t('currentUser.autoAway')}`);
        state.setIsAutoAway(true);
      }
    }, AUTO_AWAY_TIMEOUT);
  };

  const startInactivityTimer = useEffectEvent(resetInactivityTimer);

  useEffect(() => {
    startInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  const switchDraft = useEffectEvent((previousChannel: string, nextChannel: string) => {
    setDraft(previousChannel, message);
    setMessage(getDraft(nextChannel));

    historyIndex.current = -1;
    currentInputBeforeHistory.current = '';
  });

  useEffect(() => {
    const previousChannel = previousChannelRef.current;

    if (previousChannel !== currentChannelName) {
      switchDraft(previousChannel, currentChannelName);
      previousChannelRef.current = currentChannelName;
    }
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

    // Typing notifications are plaintext metadata, so encrypted conversations don't send them
    if (isSessionActive(currentChannelName)) {
      return;
    }

    if (event.target.value.length === 0 && typingStatus.current === 'active') {
      typingStatus.current = 'done';
      ircSendRawMessage(`@+draft/typing=${typingStatus.current};+typing=${typingStatus.current} TAGMSG ${currentChannelName}`);
    } else if (event.target.value.length > 0 && typingStatus.current !== 'active') {
      typingStatus.current = 'active';
      ircSendRawMessage(`@+draft/typing=${typingStatus.current};+typing=${typingStatus.current} TAGMSG ${currentChannelName}`);
    }
  };

  /** Encrypts and sends; on failure shows an error and never falls back to plaintext. */
  const sendEncryptedMessage = (target: string, body: string, senderNick: string, kind: BodyKind): void => {
    const localId = uuidv4();
    const isAction = kind === BodyKind.action;

    setAddMessage({
      id: localId,
      message: body,
      nick: getUser(senderNick) ?? senderNick,
      target,
      time: new Date().toISOString(),
      category: isAction ? MessageCategory.me : MessageCategory.default,
      color: isAction ? MessageColor.me : MessageColor.default,
      e2ee: 'ok',
    });

    void sendEncrypted(target, body, kind).catch((error: unknown) => {
      console.warn('E2EE: could not send message:', error);
      setUpdateMessage(target, localId, { e2ee: 'failed', message: t('e2ee.message.sendFailed', { message: body }) });
    });
  };

  const finishSend = (): void => {
    if (![STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName) && !isSessionActive(currentChannelName)) {
      typingStatus.current = 'done';
      ircSendRawMessage(`@+draft/typing=${typingStatus.current};+typing=${typingStatus.current} TAGMSG ${currentChannelName}`);
    }

    messageHistory.current = [message, ...messageHistory.current].slice(0, 10);
    historyIndex.current = -1;
    currentInputBeforeHistory.current = '';

    if (isAutoAway && isConnected) {
      ircSendRawMessage('AWAY');
      useSettingsStore.getState().setIsAutoAway(false);
    }

    resetInactivityTimer();

    setDraft(currentChannelName, '');

    setMessage('');
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (message.length === 0) {
      return;
    }

    let payload = '';
    if (message.startsWith('/')) {
      payload = parseMessageToCommand(currentChannelName, message);

      const gated = gateOutgoingCommand(payload);
      if (gated?.verdict === 'encrypt') {
        sendEncryptedMessage(gated.target, gated.body, getCurrentNick(), gated.kind);
        finishSend();
        return;
      }
      if (gated?.verdict === 'block') {
        setAddMessage({
          id: uuidv4(),
          message: t('e2ee.error.noticeBlocked', { nick: gated.target }),
          target: currentChannelName,
          time: new Date().toISOString(),
          category: MessageCategory.info,
          color: MessageColor.error,
        });
        return;
      }
    } else {
      if (![STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName)) {
        const nick = getCurrentNick();

        const formattedMessage = applyFormatting(message, fontFormatting);

        if (isSessionActive(currentChannelName)) {
          // Rendered locally even with echo-message: the echoed SICE frame is dropped by frame id
          sendEncryptedMessage(currentChannelName, formattedMessage, nick, BodyKind.message);
          finishSend();
          return;
        }

        // With echo-message the server echoes it back and it's added then
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
    ircSendCommand(payload, { window: currentChannelName });

    finishSend();
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

  /** Replaces the last word with the next name after the previous match that starts with it */
  const autocompleteFrom = (word: string, names: string[]): boolean => {
    for (const [index, name] of names.entries()) {
      if (name.toLowerCase().startsWith(word) && index > autocompleteIndex.current) {
        autocompleteIndex.current = index;

        const newMessage = autocompleteMessage.current.split(' ');
        newMessage.pop();
        newMessage.push(name);
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
        if (word !== undefined && word.length !== 0) {
          let names: string[];
          if (word.startsWith('/')) {
            names = commands;
          } else if (word.startsWith('#')) {
            names = channels.map((channel) => channel.name);
          } else {
            names = users.map((user) => user.nick);
          }

          if (!autocompleteFrom(word, names)) {
            // Past the last match: wrap around to the first
            autocompleteIndex.current = -1;
            autocompleteFrom(word, names);
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
        if (historyIndex.current === -1) {
          currentInputBeforeHistory.current = message;
        }
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
        historyIndex.current -= 1;
        if (historyIndex.current === -1) {
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
      <form className="flex items-center pt-1 pb-safe-2 pl-safe-4 pr-safe-4" onSubmit={handleSubmit}>
        {currentChannelName !== DEBUG_CHANNEL && (
          <>
            {/* User Avatar with Dropdown Menu */}
            <div className="relative mr-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-avatar-button
                    aria-label={t('main.toolbar.userMenu')}
                    className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full hover:ring-2 hover:ring-ring/50 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {currentUserAvatar ? (
                      <img
                        src={currentUserAvatar}
                        alt={nick}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-muted">
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
                  <DropdownMenuItem onClick={() => resetAndGoToStart(true)}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('currentUser.disconnect')}
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => ircReconnect()} disabled={isConnecting}>
                      <LogIn className="mr-2 h-4 w-4" />
                      {isConnecting ? t('currentUser.connecting') : t('currentUser.connect')}
                    </DropdownMenuItem>
                    {!isConnecting && (
                      <DropdownMenuItem onClick={changeServer}>
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        {t('currentUser.changeServer')}
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
              </DropdownMenu>
              {isAway && (
                <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500" aria-hidden="true">
                  <Moon className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              {awayMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white font-medium" aria-label={t('main.toolbar.awayMessageCount', { count: awayMessagesCount })}>
                  {awayMessagesCount > 99 ? '99+' : awayMessagesCount}
                </span>
              )}
            </div>

            <div className="flex-1 relative">
              <Input
                id="message-input"
                autoFocus
                value={message}
                placeholder={`${t(currentChannelCategory === ChannelCategory.priv ? 'main.toolbar.writeDm' : 'main.toolbar.write')} ${currentChannelName}`}
                aria-label={`${t(currentChannelCategory === ChannelCategory.priv ? 'main.toolbar.writeDm' : 'main.toolbar.write')} ${currentChannelName}`}
                onChange={handleChange}
                onKeyUp={handleKeyUp}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                ref={autocompleteInput}
                disabled={!isConnected}
              />
            </div>
            {message && (
              <Button type="submit" aria-label={t('main.toolbar.send')} variant="ghost" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            )}
            <Popover open={emojiPickerOpen} onOpenChange={(open) => {
                if (open && globalThis.matchMedia('(pointer: coarse)').matches) {
                  autocompleteInput.current?.blur();
                }
                setEmojiPickerOpen(open);
              }}>
              <PopoverTrigger asChild>
                <Button type="button" aria-label={t('main.toolbar.emoticons')} variant="ghost" size="icon" disabled={!isConnected}>
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end" onOpenAutoFocus={(e) => {
                  if (globalThis.matchMedia('(pointer: coarse)').matches) {
                    e.preventDefault();
                  }
                }}>
                <Suspense>
                  <EmojiPicker onEmojiClick={handleEmojiClick} autoFocusSearch={!globalThis.matchMedia('(pointer: coarse)').matches} />
                </Suspense>
              </PopoverContent>
            </Popover>
            <ColorPicker open={colorPickerOpen} onOpenChange={setColorPickerOpen} disabled={!isConnected} />
            <StylePicker open={stylePickerOpen} onOpenChange={setStylePickerOpen} disabled={!isConnected} />
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
