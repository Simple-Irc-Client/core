import { useTranslation } from 'react-i18next';
import { addIgnore, removeIgnore } from '@features/ignore/ignore';
import { useIgnoreStore } from '@features/ignore/store/ignore';
import { useSettingsStore } from '@features/settings/store/settings';
import ListSetting from './ListSetting';

const NO_MASKS: string[] = [];

const IgnoreSetting = () => {
  const { t } = useTranslation();
  const network = useSettingsStore((state) => state.server?.network);
  const masks = useIgnoreStore((state) => (network === undefined ? NO_MASKS : state.masksByNetwork[network] ?? NO_MASKS));

  if (network === undefined) {
    return null;
  }

  return (
    <ListSetting
      id="ignored"
      label={t('profileSettings.ignored')}
      placeholder={t('profileSettings.ignoredPlaceholder')}
      addLabel={t('profileSettings.addIgnored')}
      removeLabel={(word) => t('profileSettings.removeIgnored', { word })}
      items={masks}
      onAdd={addIgnore}
      onRemove={removeIgnore}
    />
  );
};

export default IgnoreSetting;
