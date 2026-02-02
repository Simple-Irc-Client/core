import { useState } from 'react';
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

  const handleJoin = (): void => {
    onJoin(selectedChannels);
    setSelectedChannels([]);
    onOpenChange(false);
  };

  const handleCancel = (): void => {
    setSelectedChannels([]);
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean): void => {
    if (!newOpen) {
      setSelectedChannels([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('channelListDialog.title')}</DialogTitle>
          <DialogDescription>{t('channelListDialog.description')}</DialogDescription>
        </DialogHeader>
        <ChannelListTable
          channelList={channelList}
          isLoading={isLoading}
          selectedChannels={selectedChannels}
          onSelectionChange={setSelectedChannels}
          excludeChannels={excludeChannels}
          height={300}
        />
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
