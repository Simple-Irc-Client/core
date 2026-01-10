import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from 'react-i18next';
import { type Server, servers } from '../../network/irc/servers';
import { getCurrentNick, setCreatorStep, setIsConnecting, setServer } from '../../store/settings';
import { ircConnect } from '../../network/irc/network';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const CreatorServer = () => {
  const { t } = useTranslation();

  const [formServer, setFormServer] = useState<Server | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleClick = (): void => {
    if (formServer !== undefined) {
      setServer(formServer);
      const nick = getCurrentNick();

      console.log('sending connect to irc command');
      ircConnect(formServer, nick);

      setIsConnecting(true);

      setCreatorStep('loading');
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('creator.server.title')}</h1>
      <form className="mt-8" onSubmit={handleSubmit}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-[300px] justify-between">
              {formServer ? formServer.network : t('creator.server.server')}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder={t('creator.server.server') ?? ''} />
              <CommandList>
                <CommandEmpty>{t('creator.server.message.no.options')}</CommandEmpty>
                <CommandGroup>
                  {servers.map((server) => (
                    <CommandItem
                      key={server.network}
                      value={server.network}
                      onSelect={() => {
                        setFormServer(server);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', formServer?.network === server.network ? 'opacity-100' : 'opacity-0')} />
                      {server.network}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button onClick={handleClick} type="button" className="w-full mt-8 mb-4" disabled={formServer == null}>
          {t('creator.server.button.next')}
        </Button>
      </form>
    </>
  );
};

export default CreatorServer;
