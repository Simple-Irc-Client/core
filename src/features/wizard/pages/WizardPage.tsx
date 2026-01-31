import { useSettingsStore } from '@features/settings/store/settings';
import WizardChannelList from '../components/WizardChannelList';
import WizardInit from '../components/WizardInit';
import WizardNick from '../components/WizardNick';
import WizardPassword from '../components/WizardPassword';
import WizardServer from '../components/WizardServer';
import WizardLoading from '../components/WizardLoading';

const Wizard = () => {
  const wizardStep = useSettingsStore((state) => state.wizardStep);

  return (
    <div className={`mx-auto ${wizardStep === 'channels' ? 'max-w-screen-md' : 'max-w-screen-sm'}`}>
      <div className="h-screen flex flex-col items-center pb-[15%]">
        {wizardStep === 'init' && (
          <div className="my-auto">
            <WizardInit />
          </div>
        )}
        {wizardStep === 'nick' && (
          <div className="my-auto">
            <WizardNick />
          </div>
        )}
        {wizardStep === 'server' && (
          <div className="my-auto">
            <WizardServer />
          </div>
        )}
        {wizardStep === 'password' && (
          <div className="my-auto">
            <WizardPassword />
          </div>
        )}
        {wizardStep === 'loading' && (
          <div className="my-auto w-full">
            <WizardLoading />
          </div>
        )}
        {wizardStep === 'channels' && (
          <div className="my-auto w-full">
            <WizardChannelList />
          </div>
        )}
      </div>
    </div>
  );
};

export default Wizard;
