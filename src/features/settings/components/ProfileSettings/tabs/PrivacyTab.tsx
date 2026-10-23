import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@features/settings/store/settings';
import { Label } from '@shared/components/ui/label';
import { Switch } from '@shared/components/ui/switch';
import IgnoreSetting from '../../IgnoreSetting';
import { SETTINGS_GRID } from '../../settingsLayout';

const PrivacyTab = () => {
  const { t } = useTranslation();
  const autoOfferEncryption = useSettingsStore((state) => state.autoOfferEncryption);
  const setAutoOfferEncryption = useSettingsStore((state) => state.setAutoOfferEncryption);
  const e2eeEnabled = useSettingsStore((state) => state.e2eeEnabled);
  const setE2eeEnabled = useSettingsStore((state) => state.setE2eeEnabled);

  return (
    <div className={SETTINGS_GRID}>
      <IgnoreSetting />
      <div className="col-span-full flex items-center gap-4">
        <Switch
          id="e2ee-enabled"
          checked={e2eeEnabled}
          onCheckedChange={setE2eeEnabled}
          data-testid="e2ee-enabled-toggle"
        />
        <Label htmlFor="e2ee-enabled">
          {t('profileSettings.e2eeEnabled')}
        </Label>
      </div>
      {e2eeEnabled && (
        <div className="col-span-full flex items-center gap-4">
          <Switch
            id="auto-offer-encryption"
            checked={autoOfferEncryption}
            onCheckedChange={setAutoOfferEncryption}
            data-testid="auto-offer-encryption-toggle"
          />
          <Label htmlFor="auto-offer-encryption">
            {t('profileSettings.autoOfferEncryption')}
          </Label>
        </div>
      )}
    </div>
  );
};

export default PrivacyTab;
