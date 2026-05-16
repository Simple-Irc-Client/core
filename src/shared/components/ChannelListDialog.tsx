import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@shared/components/ui/dialog';
import ChannelListTable from '@shared/components/ChannelListTable';
import type { ChannelList } from '@shared/types';

interface ChannelListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelList: ChannelList[];
  isLoading: boolean;
  onJoin: (channels: string[]) => void;
  excludeChannels?: string[];
}

const ChannelListDialog = ({
  open,
  onOpenChange,
  channelList,
  isLoading,
  onJoin,
  excludeChannels = [],
}: ChannelListDialogProps) => {
  const { t } = useTranslation();
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  // Channels queued by the Join button, joined only once the dialog has
  // finished closing (see handleJoin).
  const pendingJoinRef = useRef<string[] | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Joins whatever was queued, exactly once. Safe to call from both the
  // close-animation-end handler and the safety-net timer.
  const flushPendingJoin = useCallback((): void => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    const channels = pendingJoinRef.current;
    if (channels === null) {
      return;
    }
    pendingJoinRef.current = null;
    onJoin(channels);
  }, [onJoin]);

  // If the dialog unmounts before it finished animating out, don't drop the
  // queued join.
  useEffect(() => () => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
    }
    const channels = pendingJoinRef.current;
    if (channels !== null) {
      pendingJoinRef.current = null;
      onJoin(channels);
    }
  }, [onJoin]);

  const handleJoin = (): void => {
    const channels = selectedChannels;
    setSelectedChannels([]);
    if (channels.length === 0) {
      onOpenChange(false);
      return;
    }
    // Defer the join until the dialog's close animation completes. Joining
    // synchronously re-renders the entire main view (channel switch) while
    // Radix is still animating the dialog out; on WebKitGTK (Tauri/Linux)
    // that paint-vs-animation collision flashes a detached, half-rendered
    // dialog for one frame. Closing first, joining after, removes the
    // collision at its source rather than relying on the compositor.
    pendingJoinRef.current = channels;
    onOpenChange(false);
    // Safety net: if no close animation runs (reduced motion, animations
    // disabled, non-animating webview, jsdom) `animationend` never fires, so
    // flush shortly after instead. Idempotent with the animation path.
    fallbackTimerRef.current = setTimeout(flushPendingJoin, 350);
  };

  const handleCancel = (): void => {
    setSelectedChannels([]);
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean): void => {
    if (newOpen) {
      // Reopened before a queued join flushed: discard it, it's stale.
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      pendingJoinRef.current = null;
    } else {
      setSelectedChannels([]);
    }
    onOpenChange(newOpen);
  };

  // Fires when the dialog content's own close animation ends, right before
  // Radix unmounts it. Ignore bubbled child animations and the open
  // animation.
  const handleContentAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget || open || pendingJoinRef.current === null) {
      return;
    }
    flushPendingJoin();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-4xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6"
        onAnimationEnd={handleContentAnimationEnd}
      >
        <DialogHeader>
          <DialogTitle>{t('channelListDialog.title')}</DialogTitle>
          <DialogDescription>{t('channelListDialog.description')}</DialogDescription>
        </DialogHeader>
        {open && (
          <ChannelListTable
            channelList={channelList}
            isLoading={isLoading}
            selectedChannels={selectedChannels}
            onSelectionChange={setSelectedChannels}
            excludeChannels={excludeChannels}
            height={300}
          />
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleCancel}>
            {t('channelListDialog.button.cancel')}
          </Button>
          <Button onClick={handleJoin} disabled={selectedChannels.length === 0}>
            {t('channelListDialog.button.join')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelListDialog;
