import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useSettingsStore, setWizardHintDismissed } from '@features/settings/store/settings';
import { getBackgroundParam } from '@shared/lib/queryParams';
import WizardChannelList from '../components/WizardChannelList';
import WizardNick from '../components/WizardNick';
import WizardPassword from '../components/WizardPassword';
import WizardServer from '../components/WizardServer';
import WizardLoading from '../components/WizardLoading';

const getTimeOfDayGradient = (isDarkMode: boolean): string => {
  const hour = new Date().getHours();

  if (isDarkMode) {
    // Morning 6-12: warm amber → muted bronze
    if (hour >= 6 && hour < 12) {
      return 'linear-gradient(135deg, oklch(0.38 0.06 55) 0%, oklch(0.30 0.05 85) 100%)';
    }
    // Afternoon 12-18: dark teal → deep slate
    if (hour >= 12 && hour < 18) {
      return 'linear-gradient(135deg, oklch(0.32 0.05 155) 0%, oklch(0.25 0.04 220) 100%)';
    }
    // Evening 18-22: dark rose → deep plum
    if (hour >= 18 && hour < 22) {
      return 'linear-gradient(135deg, oklch(0.30 0.06 350) 0%, oklch(0.22 0.05 280) 100%)';
    }
    // Night 22-6: deep navy → near black teal
    return 'linear-gradient(135deg, oklch(0.22 0.04 260) 0%, oklch(0.18 0.03 200) 100%)';
  }

  // Morning 6-12: warm peach → soft gold
  if (hour >= 6 && hour < 12) {
    return 'linear-gradient(135deg, oklch(0.72 0.08 55) 0%, oklch(0.65 0.07 85) 100%)';
  }
  // Afternoon 12-18: teal → slate blue
  if (hour >= 12 && hour < 18) {
    return 'linear-gradient(135deg, oklch(0.65 0.08 155) 0%, oklch(0.55 0.06 220) 100%)';
  }
  // Evening 18-22: dusky rose → muted purple
  if (hour >= 18 && hour < 22) {
    return 'linear-gradient(135deg, oklch(0.55 0.08 350) 0%, oklch(0.45 0.07 280) 100%)';
  }
  // Night 22-6: deep navy → dark teal
  return 'linear-gradient(135deg, oklch(0.35 0.05 260) 0%, oklch(0.30 0.04 200) 100%)';
};

const Wizard = () => {
  const { t } = useTranslation();
  const wizardStep = useSettingsStore((state) => state.wizardStep);
  const isDarkMode = useSettingsStore((state) => state.isDarkMode);
  const isWizardHintDismissed = useSettingsStore((state) => state.isWizardHintDismissed);
  const backgroundUrl = getBackgroundParam();
  const cardClass = 'bg-background/90 backdrop-blur-md rounded-2xl p-8 shadow-lg';
  const isWideStep = wizardStep === 'channels';
  const showHint = wizardStep === 'nick' && !isWizardHintDismissed;

  return (
    <div className="relative h-screen">
      <div className="absolute inset-0" aria-hidden="true">
        {backgroundUrl ? (
          <>
            <img src={backgroundUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: getTimeOfDayGradient(isDarkMode) }} />
        )}
      </div>
      <div className={`relative mx-auto h-full ${isWideStep ? 'max-w-screen-md' : 'max-w-screen-sm'}`}>
        <div className="h-full flex flex-col items-center pb-[15%]">
          {showHint && (
            <div className="w-full mt-6" role="status">
              <div className="flex items-start gap-3 rounded-xl bg-background/80 backdrop-blur-sm px-4 py-3 text-sm text-foreground/80 shadow-sm">
                <p className="flex-1">{t('wizard.hint.message')}</p>
                <button
                  onClick={setWizardHintDismissed}
                  className="shrink-0 rounded-md p-1 hover:bg-foreground/10 transition-colors"
                  aria-label={t('wizard.hint.dismiss')}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
          {wizardStep === 'nick' && (
            <div className={`my-auto w-full ${cardClass}`}>
              <WizardNick />
            </div>
          )}
          {wizardStep === 'server' && (
            <div className={`my-auto w-full ${cardClass}`}>
              <WizardServer />
            </div>
          )}
          {wizardStep === 'password' && (
            <div className={`my-auto w-full ${cardClass}`}>
              <WizardPassword />
            </div>
          )}
          {wizardStep === 'loading' && (
            <div className={`my-auto w-full ${cardClass}`}>
              <WizardLoading />
            </div>
          )}
          {wizardStep === 'channels' && (
            <div className={`my-auto w-full ${cardClass}`}>
              <WizardChannelList />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wizard;
