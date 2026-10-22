import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';
import { connectToBouncerNetwork } from '@/network/irc/bouncer';
import BouncerNetworkList from '@features/bouncer/components/BouncerNetworkList';
import { useBouncerNetworksStore } from '@features/bouncer/store/bouncerNetworks';
import { useSettingsStore } from '@features/settings/store/settings';

interface BouncerNetworksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Switches to another network on the bouncer; opens by itself when the bouncer no longer has the one chosen */
const BouncerNetworksDialog = ({ open, onOpenChange }: BouncerNetworksDialogProps) => {
  const { t } = useTranslation();
  const boundNetworkId = useBouncerNetworksStore((state) => state.boundNetworkId);
  const mustChoose = useSettingsStore((state) => state.isConnected && state.server?.bouncer !== undefined && state.server.bouncer.networkId === undefined);

  const handleChoose = (networkId: string): void => {
    onOpenChange(false);
    connectToBouncerNetwork(networkId);
  };

  return (
    <Dialog open={open || mustChoose} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('bouncer.networks.title')}</DialogTitle>
          <DialogDescription>{t(mustChoose ? 'bouncer.networks.chooseAgain' : 'bouncer.networks.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-2">
          <BouncerNetworkList onChoose={handleChoose} currentId={boundNetworkId} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BouncerNetworksDialog;
