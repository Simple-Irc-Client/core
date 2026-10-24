import { lazy, type Ref, Suspense, useImperativeHandle, useState } from 'react';
import { type EmojiClickData } from 'emoji-picker-react';
import { Popover, PopoverAnchor, PopoverContent } from '@shared/components/ui/popover';
import { getMessages } from '@features/channels/store/channels';
import { hasReacted, sendReaction } from '@features/reactions/reactions';
import { getCurrentNick, useSettingsStore } from '@features/settings/store/settings';
import { type Message } from '@shared/types';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

export interface ReactionPickerHandle {
  open: (message: Message, anchor: HTMLElement) => void;
}

/** One picker for the whole chat, opened at the message reacted to */
const ReactionPicker = ({ ref }: { ref: Ref<ReactionPickerHandle> }) => {
  const [target, setTarget] = useState<{ message: Message; anchor: HTMLElement } | null>(null);
  const isDarkMode = useSettingsStore((state) => state.isDarkMode);

  useImperativeHandle(ref, () => ({ open: (message, anchor) => setTarget({ message, anchor }) }), []);

  const handlePick = ({ emoji }: EmojiClickData): void => {
    if (target !== null) {
      // Picking a reaction already given takes it back, as clicking it under the message does
      const message = getMessages(target.message.target).find((shown) => shown.id === target.message.id) ?? target.message;
      const existing = message.reactions?.find((reaction) => reaction.emoji === emoji);
      sendReaction(message, emoji, existing === undefined || !hasReacted(existing, getCurrentNick()));
    }
    setTarget(null);
  };

  return (
    <Popover open={target !== null} onOpenChange={(open) => { if (!open) { setTarget(null); } }}>
      <PopoverAnchor virtualRef={{ current: target?.anchor ?? null }} />
      <PopoverContent className="w-auto p-0" align="end">
        <Suspense>
          <EmojiPicker colorScheme={isDarkMode ? 'dark' : 'light'} reactionsDefaultOpen allowExpandReactions onReactionClick={handlePick} onEmojiClick={handlePick} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
};

export default ReactionPicker;
