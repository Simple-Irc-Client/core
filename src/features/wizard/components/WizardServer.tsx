import { useState } from 'react';
import { Button } from '@shared/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@shared/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Input } from '@shared/components/ui/input';
import { useTranslation } from 'react-i18next';
import { type Server, servers } from '@/network/irc/servers';
import { getCurrentNick, setWizardStep, setIsConnecting, setServer } from '@features/settings/store/settings';
import { ircConnect } from '@/network/irc/network';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const POPULAR_NETWORKS = ['Libera.Chat', 'OFTC', 'EFnet', 'IRCNet', 'Rizon', 'QuakeNet'];

const WizardServer = () => {
  const { t } = useTranslation();

  const [formServer, setFormServer] = useState<Server | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('6667');

  const popularServers = servers.filter((s) => POPULAR_NETWORKS.includes(s.network));
  const otherServers = servers.filter((s) => !POPULAR_NETWORKS.includes(s.network));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleClick = (): void => {
    let serverToConnect: Server | undefined;

    if (isCustom && customHost) {
      const hostWithPort = customPort && customPort !== '6667' ? `${customHost}:${customPort}` : customHost;
      serverToConnect = {
        default: 0,
        encoding: 'utf8',
        network: customHost,
        servers: [hostWithPort],
      };
    } else {
      serverToConnect = formServer;
    }

    if (serverToConnect !== undefined) {
      setServer(serverToConnect);
      const nick = getCurrentNick();

      ircConnect(serverToConnect, nick);

      setIsConnecting(true);

      setWizardStep('loading');
    }
  };

  const handleSelectServer = (server: Server) => {
    setFormServer(server);
    setIsCustom(false);
    setOpen(false);
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
    setFormServer(undefined);
  };

  const isValid = isCustom ? customHost.length > 0 : formServer !== undefined;

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('wizard.server.title')}</h1>
      <form className="mt-8 flex flex-col items-center" onSubmit={handleSubmit}>
        <div className="w-[300px] mb-4">
          <p className="text-sm text-muted-foreground mb-2">{t('wizard.server.popular')}</p>
          <div className="flex flex-wrap gap-2">
            {popularServers.map((server) => (
              <Button
                key={server.network}
                type="button"
                variant={formServer?.network === server.network && !isCustom ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSelectServer(server)}
              >
                {server.network}
              </Button>
            ))}
          </div>
        </div>

        <div className="w-[300px] mb-4">
          <p className="text-sm text-muted-foreground mb-2">{t('wizard.server.all')}</p>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                {formServer && !isCustom ? formServer.network : t('wizard.server.server')}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder={t('wizard.server.server') ?? ''} />
                <CommandList>
                  <CommandEmpty>{t('wizard.server.message.no.options')}</CommandEmpty>
                  <CommandGroup heading={t('wizard.server.popular')}>
                    {popularServers.map((server) => (
                      <CommandItem
                        key={server.network}
                        value={server.network}
                        onSelect={() => handleSelectServer(server)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', formServer?.network === server.network && !isCustom ? 'opacity-100' : 'opacity-0')} />
                        {server.network}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup heading={t('wizard.server.other')}>
                    {otherServers.map((server) => (
                      <CommandItem
                        key={server.network}
                        value={server.network}
                        onSelect={() => handleSelectServer(server)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', formServer?.network === server.network && !isCustom ? 'opacity-100' : 'opacity-0')} />
                        {server.network}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-[300px] mb-4">
          <p className="text-sm text-muted-foreground mb-2">{t('wizard.server.custom')}</p>
          <div className="flex gap-2">
            <Input
              placeholder={t('wizard.server.host') ?? 'irc.example.com'}
              value={customHost}
              onChange={(e) => {
                setCustomHost(e.target.value);
                if (e.target.value) handleCustomToggle();
              }}
              onFocus={handleCustomToggle}
              className="flex-1"
            />
            <Input
              placeholder={t('wizard.server.port') ?? '6667'}
              value={customPort}
              onChange={(e) => setCustomPort(e.target.value)}
              className="w-20"
            />
          </div>
        </div>

        <Button type="submit" className="w-[300px] mt-4 mb-4" disabled={!isValid}>
          {t('wizard.server.button.next')}
        </Button>
      </form>
    </>
  );
};

export default WizardServer;
