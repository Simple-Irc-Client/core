import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModesTab from '../tabs/ModesTab';
import * as network from '@/network/irc/network';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

const mockChannelModes = { n: true, t: true };

vi.mock('@features/channels/store/channelSettings', () => ({
  useChannelSettingsStore: vi.fn((selector) =>
    selector({
      isLoading: false,
      channelModes: mockChannelModes,
    })
  ),
}));

vi.mock('@features/settings/store/settings', () => ({
  useSettingsStore: vi.fn((selector) =>
    selector({
      channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
    })
  ),
}));

describe('ModesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render flags section', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByText('channelSettings.modes.flags')).toBeInTheDocument();
    });

    it('should render settings section', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByText('channelSettings.modes.settings')).toBeInTheDocument();
    });

    it('should render raw modes section', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByText('channelSettings.modes.rawModes')).toBeInTheDocument();
    });

    it('should render mode switches for available flags', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByTestId('mode-switch-n')).toBeInTheDocument();
      expect(screen.getByTestId('mode-switch-t')).toBeInTheDocument();
      expect(screen.getByTestId('mode-switch-i')).toBeInTheDocument();
      expect(screen.getByTestId('mode-switch-m')).toBeInTheDocument();
      expect(screen.getByTestId('mode-switch-s')).toBeInTheDocument();
      expect(screen.getByTestId('mode-switch-p')).toBeInTheDocument();
    });

    it('should render limit input', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByTestId('limit-input')).toBeInTheDocument();
    });

    it('should render key input', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByTestId('key-input')).toBeInTheDocument();
    });

    it('should render raw modes input', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByTestId('raw-modes-input')).toBeInTheDocument();
    });
  });

  describe('mode toggles', () => {
    it('should reflect current mode state in switches', () => {
      render(<ModesTab channelName="#test" />);

      // n and t are set in mockChannelModes
      expect(screen.getByTestId('mode-switch-n')).toBeChecked();
      expect(screen.getByTestId('mode-switch-t')).toBeChecked();
      expect(screen.getByTestId('mode-switch-i')).not.toBeChecked();
    });

    it('should send MODE +flag command when enabling a mode', () => {
      render(<ModesTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('mode-switch-i'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +i');
    });

    it('should send MODE -flag command when disabling a mode', () => {
      render(<ModesTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('mode-switch-n'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -n');
    });
  });

  describe('limit setting', () => {
    it('should send MODE +l command with limit value', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('limit-input');
      fireEvent.change(input, { target: { value: '50' } });
      fireEvent.click(screen.getByTestId('limit-set'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +l 50');
    });

    it('should send MODE -l command when clearing limit', () => {
      render(<ModesTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('limit-clear'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -l');
    });

    it('should set limit when pressing Enter', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('limit-input');
      fireEvent.change(input, { target: { value: '100' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +l 100');
    });
  });

  describe('key setting', () => {
    it('should send MODE +k command with key value', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('key-input');
      fireEvent.change(input, { target: { value: 'secretkey' } });
      fireEvent.click(screen.getByTestId('key-set'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +k secretkey');
    });

    it('should send MODE -k command when clearing key', () => {
      render(<ModesTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('key-clear'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -k *');
    });

    it('should set key when pressing Enter', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('key-input');
      fireEvent.change(input, { target: { value: 'mykey' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +k mykey');
    });
  });

  describe('raw modes', () => {
    it('should send raw MODE command when applying', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+im-nt' } });
      fireEvent.click(screen.getByTestId('raw-modes-apply'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +im-nt');
    });

    it('should apply raw modes when pressing Enter', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+s-p' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +s-p');
    });
  });

});
