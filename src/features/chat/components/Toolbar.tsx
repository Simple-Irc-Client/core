import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveSession } from '@features/networks/store/networks';
import { ChannelCategory } from '@shared/types';
import { Send } from 'lucide-react';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { Button } from '@shared/components/ui/button';
import { Textarea } from '@shared/components/ui/textarea';
import ColorPicker from './ColorPicker';
import StylePicker from './StylePicker';
import UserMenu from './UserMenu';
import EmojiPickerButton from './EmojiPickerButton';
import { useCanSendPlaintext } from '@features/chat/useCanSendPlaintext';
import { useAutoAway } from '@features/chat/useAutoAway';
import { useAutocomplete } from '@features/chat/useAutocomplete';
import { useChannelDraft } from '@features/chat/useChannelDraft';
import { useInputHistory } from '@features/chat/useInputHistory';
import { useSendMessage } from '@features/chat/useSendMessage';
import { useTypingNotifications } from '@features/chat/useTypingNotifications';
import ReplyBar from '@features/replies/components/ReplyBar';
import { clearReplyTo, useReplyToStore } from '@features/replies/store/replyTo';

const Toolbar = () => {
  const { t } = useTranslation();

  const currentChannelName: string = useActiveSession((session) => session.currentChannelName);
  const currentChannelCategory: ChannelCategory = useActiveSession((session) => session.currentChannelCategory);
  const isConnected: boolean = useActiveSession((session) => session.isConnected);
  // An encrypted conversation sends no plaintext reference to the message
  const canSendPlaintext = useCanSendPlaintext(currentChannelName);
  const storedReplyTo = useReplyToStore((state) => state.replies[currentChannelName]);
  const replyTo = canSendPlaintext ? storedReplyTo : undefined;

  // Status and Debug take no chat messages or typing notifications
  const isSystemChannel = [STATUS_CHANNEL, DEBUG_CHANNEL].includes(currentChannelName);

  const [message, setMessage] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const autoAway = useAutoAway();
  const autocomplete = useAutocomplete(currentChannelName, currentChannelCategory, setMessage);
  const draft = useChannelDraft(currentChannelName, message, setMessage);
  const history = useInputHistory(message, setMessage, currentChannelName);
  const typing = useTypingNotifications(currentChannelName, isSystemChannel);
  const sendMessage = useSendMessage(currentChannelName, isSystemChannel, replyTo);

  // Grows with its lines up to its max height
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input !== null) {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    if (replyTo !== undefined) {
      inputRef.current?.focus();
    }
  }, [replyTo]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(event.target.value);
    typing.noteInput(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (message.replaceAll('\n', '').length === 0 || sendMessage(message) === 'blocked') {
      return;
    }

    typing.noteSent();
    history.remember(message);
    autoAway.noteActivity();
    draft.clearDraft();
    setMessage('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        autocomplete.complete();
        break;
      case 'Enter':
        // Shift+Enter starts a new line; Enter while composing confirms the IME's text
        if (!event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
        autocomplete.restart();
        break;
      case 'Up':
      case 'ArrowUp':
        history.showOlder(event);
        break;
      case 'Down':
      case 'ArrowDown':
        history.showNewer(event);
        break;
      case 'Escape':
        if (replyTo !== undefined) {
          event.preventDefault();
          clearReplyTo(currentChannelName);
        }
        autocomplete.restart();
        break;
      default:
        autocomplete.restart();
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
            <UserMenu />

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
                onKeyUp={autocomplete.noteTyped}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                ref={inputRef}
                disabled={!isConnected}
              />
            </div>
            {message && (
              <Button type="submit" aria-label={t('main.toolbar.send')} variant="ghost" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            )}
            <EmojiPickerButton disabled={!isConnected} inputRef={inputRef} onPick={(emoji) => setMessage((typed) => typed + emoji)} />
            <ColorPicker open={colorPickerOpen} onOpenChange={setColorPickerOpen} disabled={!isConnected} />
            <StylePicker open={stylePickerOpen} onOpenChange={setStylePickerOpen} disabled={!isConnected} />
          </>
        )}
      </form>
    </>
  );
};

export default Toolbar;
