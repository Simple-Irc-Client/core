import { useTranslation } from 'react-i18next';
import { addIgnore, removeIgnore } from '@features/ignore/ignore';
import { useIgnoreStore } from '@features/ignore/store/ignore';
import { useNetworksStore } from '@features/networks/store/networks';
import ListSetting from './ListSetting';

const NO_MASKS: string[] = [];

const IgnoreSetting = () => {
  const { t } = useTranslation();
  const network = useNetworksStore((state) => state.activeNetworkId);
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
