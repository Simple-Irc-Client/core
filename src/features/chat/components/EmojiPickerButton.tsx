import { lazy, Suspense, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Smile } from 'lucide-react';
import type { EmojiClickData } from 'emoji-picker-react';
import { useSettingsStore } from '@features/settings/store/settings';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Button } from '@shared/components/ui/button';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

const isCoarsePointer = (): boolean => globalThis.matchMedia('(pointer: coarse)').matches;

interface EmojiPickerButtonProps {
  disabled: boolean;
  /** The input the emoji goes into: on a touch screen its keyboard is kept out of the picker's way */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onPick: (emoji: string) => void;
}

const EmojiPickerButton = ({ disabled, inputRef, onPick }: EmojiPickerButtonProps) => {
  const { t } = useTranslation();
  const isDarkMode = useSettingsStore((state) => state.isDarkMode);
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData): void => {
    onPick(emojiData.emoji);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
        if (isOpen && isCoarsePointer()) {
          inputRef.current?.blur();
        }
        setOpen(isOpen);
      }}>
      <PopoverTrigger asChild>
        <Button type="button" aria-label={t('main.toolbar.emoticons')} variant="ghost" size="icon" disabled={disabled}>
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" onOpenAutoFocus={(e) => {
          if (isCoarsePointer()) {
            e.preventDefault();
          }
        }}>
        <Suspense>
          <EmojiPicker colorScheme={isDarkMode ? 'dark' : 'light'} onEmojiClick={handleEmojiClick} autoFocusSearch={!isCoarsePointer()} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPickerButton;
