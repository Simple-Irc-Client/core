import { useEffect, useEffectEvent, useRef } from 'react';
import { getDraft, setDraft } from '@features/chat/store/drafts';

/** Each window keeps what was typed in it: switching windows puts the text away and brings back the new window's */
export const useChannelDraft = (channelName: string, message: string, setMessage: (text: string) => void): { clearDraft: () => void } => {
  const previousChannelRef = useRef(channelName);

  const switchDraft = useEffectEvent((previousChannel: string, nextChannel: string) => {
    setDraft(previousChannel, message);
    setMessage(getDraft(nextChannel));
  });

  useEffect(() => {
    const previousChannel = previousChannelRef.current;

    if (previousChannel !== channelName) {
      switchDraft(previousChannel, channelName);
      previousChannelRef.current = channelName;
    }
  }, [channelName]);

  const clearDraft = (): void => {
    setDraft(channelName, '');
  };

  return { clearDraft };
};
