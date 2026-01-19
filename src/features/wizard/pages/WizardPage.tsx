import { useSettingsStore } from '@features/settings/store/settings';
import WizardChannelList from '../components/WizardChannelList';
import WizardNick from '../components/WizardNick';
import WizardPassword from '../components/WizardPassword';
import WizardServer from '../components/WizardServer';
import WizardLoading from '../components/WizardLoading';

const Wizard = () => {
  const wizardStep = useSettingsStore((state) => state.wizardStep);

  return (
    <div className={`mx-auto ${wizardStep === 'channels' ? 'max-w-screen-md' : 'max-w-screen-sm'}`}>
      <div className="h-screen flex flex-col items-center">
        {wizardStep === 'nick' && (
          <div className="mt-auto md:mt-[40%] mb-auto">
            <WizardNick />
          </div>
        )}
        {wizardStep === 'server' && (
          <div className="mt-auto md:mt-[40%] mb-auto">
            <WizardServer />
          </div>
        )}
        {wizardStep === 'password' && (
          <div className="mt-auto md:mt-[40%] mb-auto">
            <WizardPassword />
          </div>
        )}
        {wizardStep === 'loading' && (
          <div className="mt-auto md:mt-[40%] mb-auto w-full">
            <WizardLoading />
          </div>
        )}
        {wizardStep === 'channels' && (
          <div className="mt-auto md:mt-[25%] mb-auto w-full">
            <WizardChannelList />
          </div>
        )}
      </div>
    </div>
  );
};

export default Wizard;
