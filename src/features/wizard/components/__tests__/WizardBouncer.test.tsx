import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WizardBouncer from '../WizardBouncer';
import * as settingsStore from '@features/settings/store/settings';
import * as networksStore from '@features/networks/store/networks';
import * as network from '@/network/irc/network';
import * as sasl from '@/network/irc/sasl';
import * as encryption from '@/network/encryption';
import { type Server } from '@/network/irc/servers';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircConnect: vi.fn(),
}));

vi.mock('@/network/irc/sasl', () => ({
  setSaslCredentials: vi.fn(),
}));

vi.mock('@/network/encryption', () => ({
  encryptPersistent: vi.fn((value: string) => Promise.resolve(`encrypted:${value}`)),
}));

vi.mock('@features/settings/store/settings', () => ({
  setWizardStep: vi.fn(),
}));

vi.mock('@features/networks/store/networks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/networks/store/networks')>()),
  activateNetwork: vi.fn(),
  getCurrentNick: vi.fn(),
  getServer: vi.fn(),
  setIsConnecting: vi.fn(),
}));

const server: Server = { default: 0, encoding: 'utf8', network: 'bouncer.example.net', servers: ['bouncer.example.net'] };

describe('WizardBouncer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(networksStore.getCurrentNick).mockReturnValue('alice');
    vi.mocked(networksStore.getServer).mockReturnValue(server);
  });

  const logIn = (account: string, password: string): void => {
    fireEvent.change(screen.getByLabelText('wizard.bouncer.account'), { target: { value: account } });
    fireEvent.change(screen.getByLabelText('wizard.bouncer.password'), { target: { value: password } });
    fireEvent.click(screen.getByText('wizard.bouncer.button.next'));
  };

  it('suggests the nick as the account', () => {
    render(<WizardBouncer />);

    expect(screen.getByLabelText('wizard.bouncer.account')).toHaveValue('alice');
  });

  it('logs in with the account and keeps it, encrypted, with the server for reconnects', async () => {
    render(<WizardBouncer />);

    logIn('alice-bnc', 'secret');

    await waitFor(() => expect(network.ircConnect).toHaveBeenCalled());
    const bouncerServer = { ...server, bouncer: { account: 'alice-bnc', encryptedPassword: 'encrypted:secret' } };
    expect(sasl.setSaslCredentials).toHaveBeenCalledWith('alice-bnc', 'secret');
    expect(networksStore.activateNetwork).toHaveBeenCalledWith(bouncerServer, expect.any(String));
    expect(network.ircConnect).toHaveBeenCalledWith(bouncerServer, 'alice');
    expect(settingsStore.setWizardStep).toHaveBeenCalledWith('loading');
  });

  it('needs both the account and the password', () => {
    render(<WizardBouncer />);

    fireEvent.change(screen.getByLabelText('wizard.bouncer.password'), { target: { value: 'secret' } });
    fireEvent.change(screen.getByLabelText('wizard.bouncer.account'), { target: { value: '' } });

    expect(screen.getByText('wizard.bouncer.button.next')).toBeDisabled();
  });

  it('stays on the step when the password cannot be stored', async () => {
    vi.mocked(encryption.encryptPersistent).mockRejectedValueOnce(new Error('no key'));
    render(<WizardBouncer />);

    logIn('alice-bnc', 'secret');

    expect(await screen.findByRole('alert')).toHaveTextContent('wizard.bouncer.saveFailed');
    expect(network.ircConnect).not.toHaveBeenCalled();
    expect(sasl.setSaslCredentials).not.toHaveBeenCalled();
  });

  it('connects without an account when skipped, dropping one saved earlier', () => {
    vi.mocked(networksStore.getServer).mockReturnValue({ ...server, bouncer: { account: 'old', encryptedPassword: 'encrypted:old', networkId: '3' } });
    render(<WizardBouncer />);

    fireEvent.click(screen.getByText('wizard.bouncer.button.skip'));

    expect(networksStore.activateNetwork).toHaveBeenCalledWith(server, expect.any(String));
    expect(network.ircConnect).toHaveBeenCalledWith(server, 'alice');
    expect(sasl.setSaslCredentials).not.toHaveBeenCalled();
  });
});
