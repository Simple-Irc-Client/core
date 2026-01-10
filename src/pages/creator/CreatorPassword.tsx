import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { ircSendPassword } from '../../network/irc/network';
import { setCreatorStep, useSettingsStore } from '../../store/settings';

const CreatorPassword = () => {
  const { t } = useTranslation();
  const [lastNick, setLastNick] = useState('');
  const [password, setPassword] = useState('');

  const nick = useSettingsStore((state) => state.nick);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setPassword(event.target.value);
  };

  const handleClick = (): void => {
    if (lastNick === nick) {
      ircSendPassword(password);
    }
    setCreatorStep('channels');
  };

  useEffect(() => {
    if (lastNick === '') {
      setLastNick(nick);
    }
  }, [nick]);

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('creator.password.title')}</h1>
      <form className="mt-8" onSubmit={handleSubmit}>
        {lastNick !== nick && (
          <div className="space-y-2 text-center">
            <p className="text-base">{t('creator.password.message.timeout1')}</p>
            <p className="text-base">{t('creator.password.message.timeout2')}</p>
            <p className="text-sm">{t('creator.password.message.timeout3', { nick: lastNick })}</p>
            <p className="text-sm">{t('creator.password.message.timeout4')}</p>
          </div>
        )}
        {lastNick === nick && (
          <div className="space-y-2">
            <Label htmlFor="password">{t('creator.password.password')}</Label>
            <Input id="password" type="password" required autoComplete="password" autoFocus onChange={handleChange} />
          </div>
        )}
        <Button onClick={handleClick} type="button" className="w-full mt-8 mb-4" disabled={lastNick === nick && password === ''}>
          {t('creator.password.button.next')}
        </Button>
      </form>
    </>
  );
};

export default CreatorPassword;
