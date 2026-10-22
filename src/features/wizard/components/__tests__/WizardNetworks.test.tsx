import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardNetworks from '../WizardNetworks';
import * as settingsStore from '@features/settings/store/settings';
import * as bouncer from '@/network/irc/bouncer';
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

vi.mock('@/network/irc/bouncer', () => ({
  connectToBouncerNetwork: vi.fn(),
}));

vi.mock('@features/settings/store/settings', () => ({
  resetAndGoToStart: vi.fn(),
  setWizardStep: vi.fn(),
}));

describe('WizardNetworks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearBouncerNetworks();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['soju.im/bouncer-networks', 'soju.im/bouncer-networks-notify']);
  });

  it('connects to the network chosen', () => {
    updateBouncerNetwork('7', { name: 'OFTC' });
    render(<WizardNetworks />);

    fireEvent.click(screen.getByText('OFTC'));

    expect(settingsStore.setWizardStep).toHaveBeenCalledWith('loading');
    expect(bouncer.connectToBouncerNetwork).toHaveBeenCalledWith('7');
  });

  it('goes back to the start', () => {
    render(<WizardNetworks />);

    fireEvent.click(screen.getByText('wizard.networks.button.back'));

    expect(settingsStore.resetAndGoToStart).toHaveBeenCalled();
  });
});
