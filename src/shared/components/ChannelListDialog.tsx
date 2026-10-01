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

  const pendingJoinRef = useRef<string[] | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Joining during the close animation flashes a half-rendered dialog on WebKitGTK, so join after it
    pendingJoinRef.current = channels;
    onOpenChange(false);
    // `animationend` never fires without a close animation (reduced motion, jsdom)
    fallbackTimerRef.current = setTimeout(flushPendingJoin, 350);
  };

  const handleCancel = (): void => {
    setSelectedChannels([]);
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean): void => {
    if (newOpen) {
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

  const handleContentAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget || open || pendingJoinRef.current === null) {
      return;
    }
    flushPendingJoin();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-4xl p-4 sm:p-6"
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
