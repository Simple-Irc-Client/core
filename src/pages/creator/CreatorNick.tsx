import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { setCreatorStep, setNick } from '../../store/settings';

const CreatorNick = () => {
  const { t } = useTranslation();

  const [formNick, setFormNick] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleClick = (): void => {
    if (formNick.length !== 0) {
      setNick(formNick);
      setCreatorStep('server');
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('creator.nick.title')}</h1>
      <form className="mt-8" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="nick">{t('creator.nick.nick')}</Label>
          <Input
            id="nick"
            required
            aria-label={t('creator.nick.nick') ?? ''}
            autoComplete="nick"
            autoFocus
            onChange={(event) => {
              setFormNick(event.target.value);
            }}
            value={formNick}
            tabIndex={1}
          />
        </div>
        <Button onClick={handleClick} type="button" className="w-full mt-8 mb-4" disabled={formNick === ''} tabIndex={2}>
          {t('creator.nick.button.next')}
        </Button>
      </form>
    </>
  );
};

export default CreatorNick;
