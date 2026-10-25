import { useEffect, useEffectEvent, useRef } from 'react';

/** How many of the messages sent the arrow keys can bring back */
const HISTORY_SIZE = 10;

interface InputHistory {
  remember: (sent: string) => void;
  /** Up: the message sent before the one shown, unless the caret can still move up a line */
  showOlder: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Down: the message sent after the one shown, and past the newest what the user was writing */
  showNewer: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/** What the user sent, brought back into the input with the arrow keys */
export const useInputHistory = (message: string, setMessage: (text: string) => void, channelName: string): InputHistory => {
  const sentMessages = useRef<string[]>([]);
  const shownIndex = useRef(-1);
  const unsentInput = useRef('');

  const backToInput = (): void => {
    shownIndex.current = -1;
    unsentInput.current = '';
  };

  // Another window has a draft of its own to come back to
  const leaveHistory = useEffectEvent(backToInput);
  useEffect(() => {
    leaveHistory();
  }, [channelName]);

  const remember = (sent: string): void => {
    sentMessages.current = [sent, ...sentMessages.current].slice(0, HISTORY_SIZE);
    backToInput();
  };

  const showOlder = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (message.slice(0, event.currentTarget.selectionStart).includes('\n')) {
      return;
    }
    event.preventDefault();
    if (sentMessages.current.length === 0) {
      return;
    }
    if (shownIndex.current === -1) {
      unsentInput.current = message;
    }
    if (shownIndex.current < sentMessages.current.length - 1) {
      shownIndex.current += 1;
      const older = sentMessages.current[shownIndex.current];
      if (older !== undefined) {
        setMessage(older);
      }
    }
  };

  const showNewer = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (message.includes('\n', event.currentTarget.selectionEnd)) {
      return;
    }
    event.preventDefault();
    if (shownIndex.current === -1) {
      return;
    }
    shownIndex.current -= 1;
    if (shownIndex.current === -1) {
      setMessage(unsentInput.current);
    } else {
      const newer = sentMessages.current[shownIndex.current];
      if (newer !== undefined) {
        setMessage(newer);
      }
    }
  };

  return { remember, showOlder, showNewer };
};
