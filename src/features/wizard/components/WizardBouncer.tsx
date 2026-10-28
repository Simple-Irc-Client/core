import { useState } from 'react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useTranslation } from 'react-i18next';
import { encryptPersistent } from '@/network/encryption';
import { ircConnect } from '@/network/irc/network';
import { setSaslCredentials } from '@/network/irc/sasl';
import { type Server } from '@/network/irc/servers';
import { setWizardStep } from '@features/settings/store/settings';
import { activateNetwork, getCurrentNick, getServer, setIsConnecting } from '@features/networks/store/networks';

const connect = (server: Server): void => {
  activateNetwork(server, getCurrentNick());
  ircConnect(server, getCurrentNick());
  setIsConnecting(true);
  setWizardStep('loading');
};

/** A bouncer account, for a custom server that turns out to be a bouncer (soju) */
const WizardBouncer = () => {
  const { t } = useTranslation();

  const [account, setAccount] = useState(() => getServer()?.bouncer?.account ?? getCurrentNick());
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const server = getServer();
    if (server === undefined || account === '' || password === '') {
      return;
    }

    setIsSaving(true);
    setSaveFailed(false);
    // Kept for reconnects, which log in again
    encryptPersistent(password).then((encryptedPassword) => {
      setSaslCredentials(account, password);
      connect({ ...server, bouncer: { account, encryptedPassword } });
    }).catch(() => {
      setIsSaving(false);
      setSaveFailed(true);
    });
  };

  const handleSkip = (): void => {
    const server = getServer();
    if (server === undefined) {
      return;
    }
    const { bouncer: _bouncer, ...withoutBouncer } = server;
    connect(withoutBouncer);
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('wizard.bouncer.title')}</h1>
      <p className="text-muted-foreground text-center mt-2">{t('wizard.bouncer.subtitle')}</p>
      <form className="mt-8" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="bouncer-account">{t('wizard.bouncer.account')}</Label>
          <Input id="bouncer-account" autoComplete="username" autoFocus value={account} onChange={(event) => setAccount(event.target.value)} />
        </div>
        <div className="space-y-2 mt-4">
          <Label htmlFor="bouncer-password">{t('wizard.bouncer.password')}</Label>
          <Input id="bouncer-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {saveFailed && <p role="alert" className="text-sm text-destructive mt-4">{t('wizard.bouncer.saveFailed')}</p>}
        <Button type="submit" className="w-full mt-8 mb-4" disabled={account === '' || password === '' || isSaving}>
          {t('wizard.bouncer.button.next')}
        </Button>
        <Button onClick={handleSkip} type="button" variant="ghost" className="w-full" disabled={isSaving}>
          {t('wizard.bouncer.button.skip')}
        </Button>
      </form>
    </>
  );
};

export default WizardBouncer;
