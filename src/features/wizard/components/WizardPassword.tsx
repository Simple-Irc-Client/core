import { useState } from 'react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useTranslation } from 'react-i18next';
import { ircSendPassword } from '@/network/irc/network';
import { getCurrentNick, setWizardStep, useSettingsStore } from '@features/settings/store/settings';

const WizardPassword = () => {
  const { t } = useTranslation();
  // Capture the nick at mount time using lazy initializer
  const [initialNick] = useState(() => getCurrentNick());
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
    if (initialNick === nick) {
      ircSendPassword(password);
    }
    setWizardStep('channels');
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('wizard.password.title')}</h1>
      <form className="mt-8" onSubmit={handleSubmit}>
        {initialNick !== nick && (
          <div className="space-y-2 text-center">
            <p className="text-base">{t('wizard.password.message.timeout1')}</p>
            <p className="text-base">{t('wizard.password.message.timeout2')}</p>
            <p className="text-sm">{t('wizard.password.message.timeout3', { nick: initialNick })}</p>
            <p className="text-sm">{t('wizard.password.message.timeout4')}</p>
          </div>
        )}
        {initialNick === nick && (
          <div className="space-y-2">
            <Label htmlFor="password">{t('wizard.password.password')}</Label>
            <Input id="password" type="password" required autoComplete="password" autoFocus onChange={handleChange} />
          </div>
        )}
        <Button onClick={handleClick} type="button" className="w-full mt-8 mb-4" disabled={initialNick === nick && password === ''}>
          {t('wizard.password.button.next')}
        </Button>
      </form>
    </>
  );
};

export default WizardPassword;
