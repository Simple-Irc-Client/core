import { useState } from 'react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, setWizardStep, setNick, setServer, setIsConnecting } from '@features/settings/store/settings';
import { ircConnect } from '@/network/irc/network';
import { resolveServerFromParams, isKnownServerParam } from '@shared/lib/resolveServerFromParams';
import { getServerParam } from '@shared/lib/queryParams';

const WizardNick = () => {
  const { t } = useTranslation();

  const savedNick = useSettingsStore((s) => s.nick);
  const [formNick, setFormNick] = useState(savedNick);
  const serverParam = getServerParam();
  const isCustomServer = serverParam && !isKnownServerParam();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleClick = (): void => {
    if (formNick.length !== 0) {
      setNick(formNick);

      const serverToConnect = resolveServerFromParams();
      if (serverToConnect) {
        setServer(serverToConnect);
        ircConnect(serverToConnect, formNick);
        setIsConnecting(true);
        setWizardStep('loading');
      } else {
        setWizardStep('server');
      }
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('wizard.nick.title')}</h1>
      {isCustomServer && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
          <p className="font-medium">{t('wizard.nick.customServerWarning')}</p>
          <p className="mt-1 font-mono text-xs">{serverParam}</p>
        </div>
      )}
      <form className="mt-8" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="nick">{t('wizard.nick.nick')}</Label>
          <Input
            id="nick"
            required
            aria-label={t('wizard.nick.nick') ?? ''}
            autoComplete="nick"
            autoFocus
            onChange={(event) => {
              setFormNick(event.target.value);
            }}
            value={formNick}
          />
        </div>
        <Button onClick={handleClick} type="button" className="w-full mt-8 mb-4" disabled={formNick === ''}>
          {t('wizard.nick.button.next')}
        </Button>
      </form>
    </>
  );
};

export default WizardNick;
