import { lazy, Suspense, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentNick, isSameName, useSettingsStore, type FontFormatting } from '@features/settings/store/settings';
import { ChannelCategory, type Message, MessageCategory, type User } from '@shared/types';
import { ircSendCommand, ircSendRawMessage } from '@/network/irc/network';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { buildPrivmsgs } from '@/network/irc/multiline';
import { Send, Smile } from 'lucide-react';
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
import { Textarea } from '@shared/components/ui/textarea';
import type { EmojiClickData } from 'emoji-picker-react';

const EmojiPicker = lazy(() => import('emoji-picker-react'));
import ProfileSettings from '@features/settings/components/ProfileSettings/ProfileSettings';
import AwayMessages from '@features/channels/components/AwayMessages';
import BouncerNetworksDialog from '@features/bouncer/components/BouncerNetworksDialog';
import ColorPicker from './ColorPicker';
import StylePicker from './StylePicker';
import UserMenu from './UserMenu';
import { IRC_FORMAT } from '@/shared/lib/ircFormatting';
import { ACTION_BODY, PRIVMSG_OR_NOTICE, showOwnCommandMessages } from '@features/chat/ownMessages';
import { useCanSendPlaintext } from '@features/chat/useCanSendPlaintext';
import { applySpoilerMarkup } from '@features/chat/spoilers';
import ReplyBar from '@features/replies/components/ReplyBar';
import { quoteLine, replyTags } from '@features/replies/replies';
import { clearReplyTo, useReplyToStore } from '@features/replies/store/replyTo';

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

/** Wraps the text in the IRC codes for the user's chosen style */
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

const isCoarsePointer = (): boolean => globalThis.matchMedia('(pointer: coarse)').matches;

/** The word being typed: everything after the last whitespace */
const lastWord = (text: string): string => /\S*$/.exec(text)?.[0] ?? '';

const Toolbar = () => {
  const { t } = useTranslation();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const nick: string = useSettingsStore((state) => state.nick);
  const currentUserFlags: string[] = useSettingsStore((state) => state.currentUserFlags);
  const isAway = currentUserFlags.includes('away');
  const isAutoAway: boolean = useSettingsStore((state) => state.isAutoAway);
  const autoAwayMinutes = useSettingsStore((state) => state.autoAwayMinutes);
  const isConnected: boolean = useSettingsStore((state) => state.isConnected);
  const fontFormatting = useSettingsStore((state) => state.fontFormatting);
  // An encrypted conversation sends no plaintext reference to the message
  const canSendPlaintext = useCanSendPlaintext(currentChannelName);
  const storedReplyTo = useReplyToStore((state) => state.replies[currentChannelName]);
  const replyTo = canSendPlaintext ? storedReplyTo : undefined;

  // Status and Debug take no chat messages or typing notifications
  const isSystemChannel = [STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName);

  const [message, setMessage] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [awayDialogOpen, setAwayDialogOpen] = useState(false);
  const [bouncerNetworksDialogOpen, setBouncerNetworksDialogOpen] = useState(false);
  const autocompleteMessage = useRef('');
  const autocompleteIndex = useRef(-1);
  const autocompleteInput = useRef<HTMLTextAreaElement>(null);

  const typingStatus = useRef<'active' | 'paused' | 'done' | undefined>(undefined);

  const messageHistory = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const currentInputBeforeHistory = useRef('');
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousChannelRef = useRef<string>(currentChannelName);

  const commands = useMemo(() => {
    const commandsNotSorted = currentChannelCategory === ChannelCategory.channel || currentChannelCategory === ChannelCategory.priv ? generalCommands.concat(channelCommands) : generalCommands;
    return [...commandsNotSorted].sort((a, b) => {
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

    if (autoAwayMinutes === 0 || (isAway && !isAutoAway)) {
      return;
    }

    inactivityTimerRef.current = setTimeout(() => {
      const state = useSettingsStore.getState();
      if (state.isConnected && !state.currentUserFlags.includes('away')) {
        const message = state.autoAwayMessage.trim() || t('currentUser.autoAway', { minutes: autoAwayMinutes });
        ircSendRawMessage(`AWAY :${message}`);
        state.setIsAutoAway(true);
      }
    }, autoAwayMinutes * 60 * 1000);
  };

  const startInactivityTimer = useEffectEvent(resetInactivityTimer);

  // A changed setting counts from now
  useEffect(() => {
    startInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [autoAwayMinutes]);

  // Grows with its lines up to its max height
  useLayoutEffect(() => {
    const input = autocompleteInput.current;
    if (input !== null) {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    if (replyTo !== undefined) {
      autocompleteInput.current?.focus();
    }
  }, [replyTo]);

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

  const sendTypingStatus = (status: 'active' | 'done'): void => {
    // Client tags such as +typing need message-tags; other servers would answer with an error
    if (!isCapabilityEnabled('message-tags')) {
      return;
    }
    typingStatus.current = status;
    ircSendRawMessage(`@+draft/typing=${status};+typing=${status} TAGMSG ${currentChannelName}`);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(event.target.value);

    if (isSystemChannel) {
      return;
    }

    // Typing notifications are plaintext metadata, so encrypted conversations don't send them
    if (isSessionActive(currentChannelName)) {
      return;
    }

    if (event.target.value.length === 0 && typingStatus.current === 'active') {
      sendTypingStatus('done');
    } else if (event.target.value.length > 0 && typingStatus.current !== 'active') {
      sendTypingStatus('active');
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

  const sendPlainMessage = (text: string, replyTo?: Message): void => {
    const tags = replyTo === undefined ? undefined : replyTags(replyTo);
    const nick = getCurrentNick();

    for (const [index, { text: sentText, lines: [command, ...rest] }] of buildPrivmsgs(nick, currentChannelName, text, tags).entries()) {
      // With echo-message the server echoes it back and it's added then
      if (!isCapabilityEnabled('echo-message')) {
        setAddMessage({
          id: uuidv4(),
          replyTo: index === 0 && tags !== undefined ? replyTo?.msgid : undefined,
          message: sentText,
          nick: getUser(nick) ?? nick,
          target: currentChannelName,
          time: new Date().toISOString(),
          category: MessageCategory.default,
          color: MessageColor.default,
        });
      }

      ircSendCommand(command, { window: currentChannelName });
      for (const line of rest) {
        ircSendRawMessage(line);
      }
    }
  };

  const finishSend = (): void => {
    if (!isSystemChannel && !isSessionActive(currentChannelName)) {
      sendTypingStatus('done');
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

    if (message.replaceAll('\n', '').length === 0) {
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

      // With echo-message the server echoes it back and it's added then
      if (!isCapabilityEnabled('echo-message')) {
        showOwnCommandMessages(payload, currentChannelName);
      }
    } else {
      if (!isSystemChannel) {
        const nick = getCurrentNick();

        // Line by line: without draft/multiline each line is a message of its own
        const formattedMessage = message
          .split('\n')
          .map((line) => (line === '' ? line : applyFormatting(applySpoilerMarkup(line, fontFormatting.colorCode), fontFormatting)))
          .join('\n');

        if (isSessionActive(currentChannelName)) {
          // Rendered locally even with echo-message: the echoed SICE frame is dropped by frame id
          sendEncryptedMessage(currentChannelName, formattedMessage, nick, BodyKind.message);
          finishSend();
          return;
        }

        // Where the server can't refer to the message, the reply quotes it on a line of its own first
        if (replyTo !== undefined && replyTags(replyTo) === undefined) {
          sendPlainMessage(quoteLine(replyTo));
        }
        sendPlainMessage(formattedMessage, replyTo);
        clearReplyTo(currentChannelName);
        finishSend();
        return;
      }
    }
    ircSendCommand(payload, { window: currentChannelName });

    finishSend();
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
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

        const typed = autocompleteMessage.current;
        setMessage(`${typed.slice(0, typed.length - lastWord(typed).length)}${name} `);

        return true;
      }
    }
    return false;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    switch (event.key) {
      case 'Tab': {
        event.preventDefault();
        const word = lastWord(autocompleteMessage.current).toLowerCase();
        if (word.length !== 0) {
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
      case 'Enter':
        // Shift+Enter starts a new line; Enter while composing confirms the IME's text
        if (!event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
        autocompleteIndex.current = -1;
        break;
      case 'Up':
      case 'ArrowUp': {
        // Within the text it moves the caret up a line
        if (message.slice(0, event.currentTarget.selectionStart).includes('\n')) {
          return;
        }
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
        if (message.includes('\n', event.currentTarget.selectionEnd)) {
          return;
        }
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
      case 'Escape':
        if (replyTo !== undefined) {
          event.preventDefault();
          clearReplyTo(currentChannelName);
        }
        autocompleteIndex.current = -1;
        break;
      default:
        autocompleteIndex.current = -1;
        break;
    }
  };

  const inputLabel = `${t(currentChannelCategory === ChannelCategory.priv ? 'main.toolbar.writeDm' : 'main.toolbar.write')} ${currentChannelName}`;

  return (
    <>
      {replyTo !== undefined && <ReplyBar message={replyTo} onCancel={() => clearReplyTo(currentChannelName)} />}
      <form className="flex items-end pt-1 pb-safe-2 pl-safe-4 pr-safe-4" onSubmit={handleSubmit}>
        {currentChannelName !== DEBUG_CHANNEL && (
          <>
            <UserMenu
              onOpenProfile={() => setProfileDialogOpen(true)}
              onOpenAwayMessages={() => setAwayDialogOpen(true)}
              onOpenBouncerNetworks={() => setBouncerNetworksDialogOpen(true)}
            />

            <div className="flex-1 relative">
              <Textarea
                id="message-input"
                // A long window name would wrap the placeholder past the one line the empty input is tall
                className="max-h-40 placeholder:truncate"
                rows={1}
                autoFocus
                value={message}
                placeholder={inputLabel}
                aria-label={inputLabel}
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
                if (open && isCoarsePointer()) {
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
                  if (isCoarsePointer()) {
                    e.preventDefault();
                  }
                }}>
                <Suspense>
                  <EmojiPicker onEmojiClick={handleEmojiClick} autoFocusSearch={!isCoarsePointer()} />
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

      <BouncerNetworksDialog
        open={bouncerNetworksDialogOpen}
        onOpenChange={setBouncerNetworksDialogOpen}
      />

    </>
  );
};

export default Toolbar;
