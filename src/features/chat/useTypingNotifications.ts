import { useRef } from 'react';
import { ircSendRawMessage } from '@/network/irc/network';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { isSessionActive } from '@features/e2ee/store/e2ee';

type TypingStatus = 'active' | 'done';

/** Tells the window when the user starts and stops typing; Status and Debug take none, and neither does an encrypted conversation */
export const useTypingNotifications = (channelName: string, isSystemChannel: boolean): { noteInput: (text: string) => void; noteSent: () => void } => {
  const typingStatus = useRef<TypingStatus | undefined>(undefined);

  const sendTypingStatus = (status: TypingStatus): void => {
    // Client tags such as +typing need message-tags; other servers would answer with an error
    if (!isCapabilityEnabled('message-tags')) {
      return;
    }
    typingStatus.current = status;
    ircSendRawMessage(`@+draft/typing=${status};+typing=${status} TAGMSG ${channelName}`);
  };

  // Typing notifications are plaintext metadata, so encrypted conversations don't send them
  const isTold = (): boolean => !isSystemChannel && !isSessionActive(channelName);

  /** The input now holds `text` */
  const noteInput = (text: string): void => {
    if (!isTold()) {
      return;
    }

    if (text.length === 0 && typingStatus.current === 'active') {
      sendTypingStatus('done');
    } else if (text.length > 0 && typingStatus.current !== 'active') {
      sendTypingStatus('active');
    }
  };

  const noteSent = (): void => {
    if (isTold()) {
      sendTypingStatus('done');
    }
  };

  return { noteInput, noteSent };
};
