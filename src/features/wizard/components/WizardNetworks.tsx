import { Button } from '@shared/components/ui/button';
import { useTranslation } from 'react-i18next';
import { connectToBouncerNetwork } from '@/network/irc/bouncer';
import BouncerNetworkList from '@features/bouncer/components/BouncerNetworkList';
import { setWizardStep } from '@features/settings/store/settings';
import { resetAndGoToStart } from '@features/networks/networkLifecycle';

/** The networks on the bouncer account; picking one connects to it */
const WizardNetworks = () => {
  const { t } = useTranslation();

  const handleChoose = (networkId: string): void => {
    setWizardStep('loading');
    connectToBouncerNetwork(networkId);
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('wizard.networks.title')}</h1>
      <p className="text-muted-foreground text-center mt-2">{t('wizard.networks.subtitle')}</p>
      <div className="mt-8">
        <BouncerNetworkList onChoose={handleChoose} />
      </div>
      <Button onClick={() => resetAndGoToStart()} type="button" variant="ghost" className="w-full mt-4">
        {t('wizard.networks.button.back')}
      </Button>
    </>
  );
};

export default WizardNetworks;
