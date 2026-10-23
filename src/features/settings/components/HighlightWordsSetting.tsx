import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useSettingsStore } from '@features/settings/store/settings';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';

const HighlightWordsSetting = () => {
  const { t } = useTranslation();
  const highlightWords = useSettingsStore((state) => state.highlightWords);
  const setHighlightWords = useSettingsStore((state) => state.setHighlightWords);
  const [newWord, setNewWord] = useState('');

  const handleAdd = (): void => {
    const word = newWord.trim();
    if (word.length === 0) {
      return;
    }
    if (!highlightWords.some((existing) => existing.toLowerCase() === word.toLowerCase())) {
      setHighlightWords([...highlightWords, word]);
    }
    setNewWord('');
  };

  const handleRemove = (word: string): void => {
    setHighlightWords(highlightWords.filter((existing) => existing !== word));
  };

  return (
    <>
      <div className="col-span-full grid grid-cols-subgrid items-center">
        <Label htmlFor="highlight-word" className="text-right">
          {t('profileSettings.highlightWords')}
        </Label>
        <Input
          id="highlight-word"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          className="col-span-2"
          placeholder={t('profileSettings.highlightWordsPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          {t('profileSettings.addHighlightWord')}
        </Button>
      </div>
      {highlightWords.length > 0 && (
        <ul className="col-span-3 col-start-2 flex flex-wrap gap-2" data-testid="highlight-words">
          {highlightWords.map((word) => (
            <li key={word}>
              <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                {word}
                <button
                  type="button"
                  onClick={() => handleRemove(word)}
                  aria-label={t('profileSettings.removeHighlightWord', { word })}
                  className="rounded-sm opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default HighlightWordsSetting;
