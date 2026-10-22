import { useEffect } from 'react';
import { Button } from '@shared/components/ui/button';
import { useTranslation } from 'react-i18next';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { ircSendRawMessage } from '@/network/irc/network';
import { useBouncerNetworksStore } from '@features/bouncer/store/bouncerNetworks';

const KNOWN_STATES = new Set(['connected', 'connecting', 'disconnected']);

interface BouncerNetworkListProps {
  onChoose: (networkId: string) => void;
  /** The network this connection is bound to */
  currentId?: string;
}

/** The networks on the bouncer account, with their address, state and last error */
const BouncerNetworkList = ({ onChoose, currentId }: BouncerNetworkListProps) => {
  const { t } = useTranslation();
  const networks = useBouncerNetworksStore((state) => state.networks);

  useEffect(() => {
    // With -notify the bouncer has already sent the list
    if (!isCapabilityEnabled('soju.im/bouncer-networks-notify')) {
      ircSendRawMessage('BOUNCER LISTNETWORKS');
    }
  }, []);

  if (networks.length === 0) {
    return <p className="text-center">{t('bouncer.networks.empty')}</p>;
  }

  return (
    <ul className="space-y-2">
      {networks.map(({ id, attributes }) => {
        const { name, host, port, state, error } = attributes;
        const isCurrent = id === currentId;
        return (
          <li key={id}>
            <Button type="button" variant="outline" className="w-full h-auto py-3 justify-between gap-4 text-left" aria-current={isCurrent} disabled={isCurrent} onClick={() => onChoose(id)}>
              <span className="flex flex-col min-w-0">
                <span className="font-medium truncate">{name ?? host ?? id}</span>
                {host !== undefined && <span className="text-xs text-muted-foreground truncate">{port === undefined ? host : `${host}:${port}`}</span>}
                {error !== undefined && <span className="text-xs text-destructive whitespace-normal">{error}</span>}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {isCurrent ? t('bouncer.networks.current') : state !== undefined && (KNOWN_STATES.has(state) ? t(`bouncer.networks.state.${state}`) : state)}
              </span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
};

export default BouncerNetworkList;
