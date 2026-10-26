import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BouncerNetworksDialog from '../BouncerNetworksDialog';
import * as bouncer from '@/network/irc/bouncer';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import { type Server } from '@/network/irc/servers';
import { clearBouncerNetworks, setBoundBouncerNetworkId, updateBouncerNetwork } from '@features/bouncer/store/bouncerNetworks';
import { connectTestNetwork, setTestSession } from '@/test/networks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

vi.mock('@/network/irc/bouncer', () => ({
  connectToBouncerNetwork: vi.fn(),
}));

const bouncerServer = (networkId?: string): Server => ({
  default: 0,
  encoding: 'utf8',
  network: 'bouncer.example.net',
  servers: ['bouncer.example.net'],
  bouncer: { account: 'alice', encryptedPassword: 'x', networkId },
});

describe('BouncerNetworksDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    clearBouncerNetworks();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['soju.im/bouncer-networks', 'soju.im/bouncer-networks-notify']);
    connectTestNetwork(bouncerServer('1'));
    setTestSession({ isConnected: true });
    updateBouncerNetwork('1', { name: 'Libera', state: 'connected' });
    updateBouncerNetwork('2', { name: 'OFTC', state: 'connected' });
  });

  it('switches to another network and closes', () => {
    setBoundBouncerNetworkId('1');
    render(<BouncerNetworksDialog open onOpenChange={onOpenChange} />);

    expect(screen.getByRole('button', { name: /Libera/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /OFTC/ }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(bouncer.connectToBouncerNetwork).toHaveBeenCalledExactlyOnceWith('2');
  });

  it('stays closed until asked for', () => {
    render(<BouncerNetworksDialog open={false} onOpenChange={onOpenChange} />);

    expect(screen.queryByText('bouncer.networks.title')).not.toBeInTheDocument();
  });

  it('opens by itself when the bouncer refused the network chosen', () => {
    connectTestNetwork(bouncerServer());
    setTestSession({ isConnected: true });

    render(<BouncerNetworksDialog open={false} onOpenChange={onOpenChange} />);

    expect(screen.getByText('bouncer.networks.title')).toBeInTheDocument();
    expect(screen.getByText('bouncer.networks.chooseAgain')).toBeInTheDocument();
  });

  it('does not open by itself while disconnected', () => {
    connectTestNetwork(bouncerServer());
    setTestSession({ isConnected: false });

    render(<BouncerNetworksDialog open={false} onOpenChange={onOpenChange} />);

    expect(screen.queryByText('bouncer.networks.title')).not.toBeInTheDocument();
  });
});
