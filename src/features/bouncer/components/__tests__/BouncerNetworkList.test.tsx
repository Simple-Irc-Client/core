import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BouncerNetworkList from '../BouncerNetworkList';
import * as network from '@/network/irc/network';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import { clearBouncerNetworks, updateBouncerNetwork } from '@features/bouncer/store/bouncerNetworks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

describe('BouncerNetworkList', () => {
  const onChoose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    clearBouncerNetworks();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['soju.im/bouncer-networks', 'soju.im/bouncer-networks-notify']);
  });

  it('lists the networks with their address, state and error', () => {
    updateBouncerNetwork('1', { name: 'Libera', host: 'irc.libera.chat', port: '6697', state: 'connected' });
    updateBouncerNetwork('2', { host: 'irc.example.net', state: 'disconnected', error: 'connection refused' });

    render(<BouncerNetworkList onChoose={onChoose} />);

    expect(screen.getByText('Libera')).toBeInTheDocument();
    expect(screen.getByText('irc.libera.chat:6697')).toBeInTheDocument();
    expect(screen.getByText('bouncer.networks.state.connected')).toBeInTheDocument();
    // Named by its host when it has no name
    expect(screen.getAllByText('irc.example.net')).toHaveLength(2);
    expect(screen.getByText('connection refused')).toBeInTheDocument();
    expect(screen.getByText('bouncer.networks.state.disconnected')).toBeInTheDocument();
  });

  it('passes on the network chosen', () => {
    updateBouncerNetwork('7', { name: 'OFTC' });
    render(<BouncerNetworkList onChoose={onChoose} />);

    fireEvent.click(screen.getByText('OFTC'));

    expect(onChoose).toHaveBeenCalledExactlyOnceWith('7');
  });

  it('marks the current network, which cannot be chosen again', () => {
    updateBouncerNetwork('1', { name: 'Libera', state: 'connected' });
    updateBouncerNetwork('2', { name: 'OFTC', state: 'connected' });
    render(<BouncerNetworkList onChoose={onChoose} currentId="1" />);

    const current = screen.getByRole('button', { name: /Libera/ });
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(current).toBeDisabled();
    expect(current).toHaveTextContent('bouncer.networks.current');
    expect(screen.getByRole('button', { name: /OFTC/ })).toBeEnabled();
  });

  it('says so when the account has no networks', () => {
    render(<BouncerNetworkList onChoose={onChoose} />);

    expect(screen.getByText('bouncer.networks.empty')).toBeInTheDocument();
  });

  it('shows a state it does not know as the bouncer sent it', () => {
    updateBouncerNetwork('1', { name: 'Libera', state: 'sleeping' });

    render(<BouncerNetworkList onChoose={onChoose} />);

    expect(screen.getByText('sleeping')).toBeInTheDocument();
  });

  it('asks for the list only when the bouncer does not send it unasked', () => {
    render(<BouncerNetworkList onChoose={onChoose} />);
    expect(network.ircSendRawMessage).not.toHaveBeenCalled();

    resetCapabilityState();
    markCapabilitiesAcknowledged(['soju.im/bouncer-networks']);
    render(<BouncerNetworkList onChoose={onChoose} />);
    expect(network.ircSendRawMessage).toHaveBeenCalledExactlyOnceWith('BOUNCER LISTNETWORKS');
  });
});
