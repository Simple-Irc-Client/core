import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { useChannelSettingsStore, clearChannelSettingsStore, type ActiveTab } from '@features/channels/store/channelSettings';
import { ircSendRawMessage } from '@/network/irc/network';
import ModesTab from './tabs/ModesTab';
import ListsTab from './tabs/ListsTab';

interface ChannelSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
}

interface ChannelSettingsContentProps {
  channelName: string;
}

const ChannelSettingsContent = ({ channelName }: ChannelSettingsContentProps) => {
  const { t } = useTranslation();
  const activeTab = useChannelSettingsStore((state) => state.activeTab);
  const setActiveTab = useChannelSettingsStore((state) => state.setActiveTab);
  const setChannelName = useChannelSettingsStore((state) => state.setChannelName);
  const setIsLoading = useChannelSettingsStore((state) => state.setIsLoading);
  const setBanList = useChannelSettingsStore((state) => state.setBanList);
  const setExceptionList = useChannelSettingsStore((state) => state.setExceptionList);
  const setInviteList = useChannelSettingsStore((state) => state.setInviteList);
  const setIsBanListLoading = useChannelSettingsStore((state) => state.setIsBanListLoading);
  const setIsExceptionListLoading = useChannelSettingsStore((state) => state.setIsExceptionListLoading);
  const setIsInviteListLoading = useChannelSettingsStore((state) => state.setIsInviteListLoading);

  useEffect(() => {
    // Set channel name and fetch initial data
    setChannelName(channelName);
    setIsLoading(true);

    // Query current channel modes
    ircSendRawMessage(`MODE ${channelName}`);

    // Query lists
    setBanList([]);
    setExceptionList([]);
    setInviteList([]);
    setIsBanListLoading(true);
    setIsExceptionListLoading(true);
    setIsInviteListLoading(true);

    ircSendRawMessage(`MODE ${channelName} b`);
    ircSendRawMessage(`MODE ${channelName} e`);
    ircSendRawMessage(`MODE ${channelName} I`);
  }, [channelName, setChannelName, setIsLoading, setBanList, setExceptionList, setInviteList, setIsBanListLoading, setIsExceptionListLoading, setIsInviteListLoading]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as ActiveTab);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('channelSettings.title', { channel: channelName })}</DialogTitle>
        <DialogDescription>{t('channelSettings.description')}</DialogDescription>
      </DialogHeader>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="modes" data-testid="tab-modes">
            {t('channelSettings.tabs.modes')}
          </TabsTrigger>
          <TabsTrigger value="lists" data-testid="tab-lists">
            {t('channelSettings.tabs.lists')}
          </TabsTrigger>
        </TabsList>
        <div className="min-h-[540px]">
          <TabsContent value="modes">
            <ModesTab channelName={channelName} />
          </TabsContent>
          <TabsContent value="lists">
            <ListsTab channelName={channelName} />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
};

const ChannelSettings = ({ open, onOpenChange, channelName }: ChannelSettingsProps) => {
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Clear store when dialog closes
      clearChannelSettingsStore();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {open && <ChannelSettingsContent channelName={channelName} />}
      </DialogContent>
    </Dialog>
  );
};

export default ChannelSettings;
