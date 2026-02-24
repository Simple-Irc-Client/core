import { useState, useEffect } from 'react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Switch } from '@shared/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { ircSendPassword, ircJoinChannels } from '@/network/irc/network';
import { getCurrentNick, setWizardStep, setWizardCompleted, useSettingsStore, setEncryptedPassword } from '@features/settings/store/settings';
import { getChannelParam } from '@shared/lib/queryParams';
import { encryptPersistent, decryptPersistent } from '@/network/encryption';

const WizardPassword = () => {
  const { t } = useTranslation();
  // Capture the nick at mount time using lazy initializer
  const [initialNick] = useState(() => getCurrentNick());
  const [password, setPassword] = useState('');

  const nick = useSettingsStore((state) => state.nick);
  const encryptedPassword = useSettingsStore((state) => state.encryptedPassword);
  const passwordNick = useSettingsStore((state) => state.passwordNick);

  const hasSavedPassword = !!(encryptedPassword && passwordNick === initialNick);
  const [rememberPassword, setRememberPassword] = useState(hasSavedPassword);

  // Pre-fill from saved encrypted password
  useEffect(() => {
    if (encryptedPassword && passwordNick === initialNick) {
      decryptPersistent(encryptedPassword).then((decrypted) => {
        setPassword(decrypted);
      }).catch(() => {
        // Decryption failed (e.g. key changed) - ignore
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (rememberPassword) {
        // Save encrypted password for future sessions
        encryptPersistent(password).then((encrypted) => {
          setEncryptedPassword(encrypted, nick);
        }).catch(() => {
          // Encryption failed - password won't be saved, but that's ok
        });
      } else {
        // Clear any previously saved password
        setEncryptedPassword(undefined, undefined);
      }
    }
    const channels = getChannelParam();
    if (channels) {
      ircJoinChannels(channels);
      setWizardCompleted(true);
    } else {
      setWizardStep('channels');
    }
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
            <Input id="password" type="password" required autoComplete="password" autoFocus value={password} onChange={handleChange} />
            <div className="flex items-center gap-4">
              <Switch
                id="remember-password"
                checked={rememberPassword}
                onCheckedChange={setRememberPassword}
                aria-label={t('wizard.password.rememberPassword')}
              />
              <Label htmlFor="remember-password">
                {t('wizard.password.rememberPassword')}
              </Label>
            </div>
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
