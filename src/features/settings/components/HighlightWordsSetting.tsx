import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@features/settings/store/settings';
import ListSetting from './ListSetting';

const HighlightWordsSetting = () => {
  const { t } = useTranslation();
  const highlightWords = useSettingsStore((state) => state.highlightWords);
  const setHighlightWords = useSettingsStore((state) => state.setHighlightWords);

  const handleAdd = (word: string): boolean => {
    if (!highlightWords.some((existing) => existing.toLowerCase() === word.toLowerCase())) {
      setHighlightWords([...highlightWords, word]);
    }
    return true;
  };

  return (
    <ListSetting
      id="highlight-words"
      label={t('profileSettings.highlightWords')}
      placeholder={t('profileSettings.highlightWordsPlaceholder')}
      addLabel={t('profileSettings.addHighlightWord')}
      removeLabel={(word) => t('profileSettings.removeHighlightWord', { word })}
      items={highlightWords}
      onAdd={handleAdd}
      onRemove={(word) => setHighlightWords(highlightWords.filter((existing) => existing !== word))}
    />
  );
};

export default HighlightWordsSetting;
