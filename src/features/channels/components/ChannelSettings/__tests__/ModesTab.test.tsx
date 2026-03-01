import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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

let mockChannelModes: Record<string, string | boolean> = { n: true, t: true };
let mockChannelData: { avatar?: string; displayName?: string } = {};

vi.mock('@features/channels/store/channelSettings', () => ({
  useChannelSettingsStore: vi.fn((selector) =>
    selector({
      isLoading: false,
      get channelModes() { return mockChannelModes; },
    })
  ),
}));

vi.mock('@features/channels/store/channels', () => ({
  useChannelsStore: vi.fn((selector) =>
    selector({
      openChannels: [{ name: '#test', ...mockChannelData }],
    })
  ),
}));

import { useSettingsStore } from '@features/settings/store/settings';

vi.mock('@features/settings/store/settings', () => ({
  useSettingsStore: vi.fn((selector) =>
    selector({
      channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
      supportedOptions: [],
    })
  ),
}));

describe('ModesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannelModes = { n: true, t: true };
    mockChannelData = {};
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
    it('should display all current flags including parameterized ones', () => {
      mockChannelModes = { n: true, t: true, f: '[4j#R3]:6', H: '15:1d' };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input') as HTMLInputElement;
      expect(input.value).toBe('+ntfH');
    });

    it('should send only removed flags when a flag is removed', () => {
      mockChannelModes = { n: true, r: true, t: true, B: true, C: true, N: true, R: true };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+nrtBCN' } });
      fireEvent.click(screen.getByTestId('raw-modes-apply'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -R');
    });

    it('should send only added flags when a flag is added', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+nts' } });
      fireEvent.click(screen.getByTestId('raw-modes-apply'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +s');
    });

    it('should send both added and removed flags in one command', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+nim' } });
      fireEvent.click(screen.getByTestId('raw-modes-apply'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +im-t');
    });

    it('should not send anything when flags are unchanged', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+nt' } });
      fireEvent.click(screen.getByTestId('raw-modes-apply'));

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should handle removing parameterized flags', () => {
      mockChannelModes = { n: true, t: true, f: '[4j#R3]:6', H: '15:1d' };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+ntf' } });
      fireEvent.click(screen.getByTestId('raw-modes-apply'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -H');
    });

    it('should apply raw modes when pressing Enter', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+nts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +s');
    });

    it('should not send anything when input is empty', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(screen.getByTestId('raw-modes-apply'));

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should handle removing multiple flags at once', () => {
      mockChannelModes = { n: true, r: true, t: true, B: true, C: true, N: true, R: true };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('raw-modes-input');
      fireEvent.change(input, { target: { value: '+nrt' } });
      fireEvent.click(screen.getByTestId('raw-modes-apply'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -BCNR');
    });
  });

  describe('parameterized modes', () => {
    it('should render inputs for parameterized modes', () => {
      mockChannelModes = { n: true, t: true, f: '[4j#R3]:6', H: '15:1d' };
      render(<ModesTab channelName="#test" />);

      expect(screen.getByTestId('param-mode-f-input')).toBeInTheDocument();
      expect(screen.getByTestId('param-mode-H-input')).toBeInTheDocument();
    });

    it('should display current parameter value', () => {
      mockChannelModes = { n: true, f: '[4j#R3]:6' };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('param-mode-f-input') as HTMLInputElement;
      expect(input.value).toBe('[4j#R3]:6');
    });

    it('should not render inputs for dedicated flags l and k', () => {
      mockChannelModes = { n: true, l: '50', k: 'secret' };
      render(<ModesTab channelName="#test" />);

      expect(screen.queryByTestId('param-mode-l-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('param-mode-k-input')).not.toBeInTheDocument();
    });

    it('should not render inputs for boolean flags', () => {
      mockChannelModes = { n: true, t: true };
      render(<ModesTab channelName="#test" />);

      expect(screen.queryByTestId('param-mode-n-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('param-mode-t-input')).not.toBeInTheDocument();
    });

    it('should send MODE +flag with value when setting', () => {
      mockChannelModes = { n: true, f: '[4j#R3]:6' };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('param-mode-f-input');
      fireEvent.change(input, { target: { value: '[5j#R3]:8' } });
      fireEvent.click(screen.getByTestId('param-mode-f-set'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +f [5j#R3]:8');
    });

    it('should send MODE -flag when clearing', () => {
      mockChannelModes = { n: true, H: '15:1d' };
      render(<ModesTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('param-mode-H-clear'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -H');
    });

    it('should set parameterized mode when pressing Enter', () => {
      mockChannelModes = { n: true, f: '[4j#R3]:6' };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('param-mode-f-input');
      fireEvent.change(input, { target: { value: '[5j]:3' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +f [5j]:3');
    });

    it('should show +flag as label', () => {
      mockChannelModes = { n: true, f: '[4j#R3]:6' };
      render(<ModesTab channelName="#test" />);

      expect(screen.getByText('+f')).toBeInTheDocument();
    });
  });

  describe('display name setting', () => {
    beforeEach(() => {
      vi.mocked(useSettingsStore).mockImplementation((selector) =>
        selector({
          channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
          supportedOptions: ['metadata-display-name'],
        } as never)
      );
    });

    afterEach(() => {
      vi.mocked(useSettingsStore).mockImplementation((selector) =>
        selector({
          channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
          supportedOptions: [],
        } as never)
      );
    });

    it('should render display name input when metadata-display-name is supported', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByTestId('displayName-input')).toBeInTheDocument();
    });

    it('should send METADATA SET display-name command with colon prefix', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('displayName-input');
      fireEvent.change(input, { target: { value: 'My Channel Name' } });
      fireEvent.click(screen.getByTestId('displayName-set'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA #test SET display-name :My Channel Name');
    });

    it('should send METADATA SET display-name without value when clearing', () => {
      render(<ModesTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('displayName-clear'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA #test SET display-name');
    });

    it('should set display name when pressing Enter', () => {
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('displayName-input');
      fireEvent.change(input, { target: { value: 'Test Display Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA #test SET display-name :Test Display Name');
    });

    it('should display translated display name label', () => {
      render(<ModesTab channelName="#test" />);

      expect(screen.getByText('channelSettings.modes.displayName')).toBeInTheDocument();
    });
  });

  describe('display name populated from channel store', () => {
    beforeEach(() => {
      vi.mocked(useSettingsStore).mockImplementation((selector) =>
        selector({
          channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
          supportedOptions: ['metadata-display-name'],
        } as never)
      );
    });

    afterEach(() => {
      vi.mocked(useSettingsStore).mockImplementation((selector) =>
        selector({
          channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
          supportedOptions: [],
        } as never)
      );
    });

    it('should show display name from channel store', () => {
      mockChannelData = { displayName: 'My Cool Channel' };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('displayName-input') as HTMLInputElement;
      expect(input.value).toBe('My Cool Channel');
    });

    it('should show empty input when channel has no display name', () => {
      mockChannelData = {};
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('displayName-input') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('avatar populated from channel store', () => {
    beforeEach(() => {
      vi.mocked(useSettingsStore).mockImplementation((selector) =>
        selector({
          channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
          supportedOptions: ['metadata-avatar'],
        } as never)
      );
    });

    afterEach(() => {
      vi.mocked(useSettingsStore).mockImplementation((selector) =>
        selector({
          channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
          supportedOptions: [],
        } as never)
      );
    });

    it('should show avatar from channel store', () => {
      mockChannelData = { avatar: 'https://example.com/avatar.png' };
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('avatar-input') as HTMLInputElement;
      expect(input.value).toBe('https://example.com/avatar.png');
    });

    it('should show empty input when channel has no avatar', () => {
      mockChannelData = {};
      render(<ModesTab channelName="#test" />);

      const input = screen.getByTestId('avatar-input') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('display name not supported', () => {
    it('should not render display name input when metadata-display-name is not supported', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector) =>
        selector({
          channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
          supportedOptions: [],
        } as never)
      );

      render(<ModesTab channelName="#test" />);

      expect(screen.queryByTestId('displayName-input')).not.toBeInTheDocument();
    });
  });

});
