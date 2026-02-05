import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  useSettingsStore,
  setWizardCompleted,
  setIsConnecting,
  setIsConnected,
  setConnectedTime,
  setNick,
  setWizardStep,
  setIsPasswordRequired,
  setTheme,
  setUserModes,
  setChannelModes,
  getChannelModes,
  setListRequestRemainingSeconds,
  setChannelTypes,
  getCurrentNick,
  getCurrentChannelName,
  getCurrentChannelCategory,
  getChannelTypes,
  getUserModes,
  getConnectedTime,
  getIsWizardCompleted,
  getIsPasswordRequired,
  setSupportedOption,
  isSupportedOption,
  setWizardProgress,
  getWizardProgress,
  setCurrentUserFlag,
  getCurrentUserFlags,
  setWatchLimit,
  setMonitorLimit,
  getWatchLimit,
  getMonitorLimit,
  setSilenceLimit,
  getSilenceLimit,
  setIsDarkMode,
  toggleDarkMode,
  getIsDarkMode,
  setHideAvatarsInUsersList,
  getHideAvatarsInUsersList,
  setFontSize,
  getFontSize,
  setCurrentUserHomepage,
  getCurrentUserHomepage,
  setCurrentUserColor,
  getCurrentUserColor,
} from '../settings';
import { ChannelCategory } from '@shared/types';

vi.mock('@features/channels/store/channels', () => ({
  getMessages: vi.fn(() => []),
  getTopic: vi.fn(() => ''),
  getTyping: vi.fn(() => []),
  setClearUnreadMessages: vi.fn(),
}));

vi.mock('@features/chat/store/current', () => ({
  useCurrentStore: {
    getState: () => ({
      setUpdateTopic: vi.fn(),
      setUpdateMessages: vi.fn(),
      setUpdateUsers: vi.fn(),
      setUpdateTyping: vi.fn(),
    }),
  },
}));

vi.mock('@features/users/store/users', () => ({
  getUsersFromChannelSortedByMode: vi.fn(() => []),
}));

describe('settings store', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      isConnecting: false,
      isConnected: false,
      isWizardCompleted: false,
      wizardStep: 'nick',
      nick: '',
      server: undefined,
      isPasswordRequired: undefined,
      connectedTime: 0,
      currentChannelName: 'Status',
      currentChannelCategory: ChannelCategory.status,
      theme: 'modern',
      userModes: [],
      channelModes: { A: [], B: [], C: [], D: [] },
      listRequestRemainingSeconds: -1,
      channelTypes: [],
      supportedOptions: [],
      wizardProgress: { value: 0, label: '' },
      currentUserFlags: [],
      watchLimit: 0,
      monitorLimit: 0,
      silenceLimit: 0,
      isDarkMode: false,
      fontSize: 'medium',
      currentUserHomepage: undefined,
      currentUserColor: undefined,
    });
    vi.clearAllMocks();
  });

  describe('connection state', () => {
    it('should set isConnecting', () => {
      setIsConnecting(true);
      expect(useSettingsStore.getState().isConnecting).toBe(true);

      setIsConnecting(false);
      expect(useSettingsStore.getState().isConnecting).toBe(false);
    });

    it('should set isConnected', () => {
      setIsConnected(true);
      expect(useSettingsStore.getState().isConnected).toBe(true);

      setIsConnected(false);
      expect(useSettingsStore.getState().isConnected).toBe(false);
    });

    it('should set connected time', () => {
      const timestamp = Date.now();
      setConnectedTime(timestamp);

      expect(getConnectedTime()).toBe(timestamp);
    });
  });

  describe('wizard state', () => {
    it('should set wizard completed status', () => {
      setWizardCompleted(true);
      expect(getIsWizardCompleted()).toBe(true);

      setWizardCompleted(false);
      expect(getIsWizardCompleted()).toBe(false);
    });

    it('should set wizard step', () => {
      setWizardStep('server');
      expect(useSettingsStore.getState().wizardStep).toBe('server');

      setWizardStep('loading');
      expect(useSettingsStore.getState().wizardStep).toBe('loading');

      setWizardStep('password');
      expect(useSettingsStore.getState().wizardStep).toBe('password');

      setWizardStep('channels');
      expect(useSettingsStore.getState().wizardStep).toBe('channels');
    });

    it('should set wizard progress', () => {
      setWizardProgress(50, 'Loading...');

      const progress = getWizardProgress();
      expect(progress.value).toBe(50);
      expect(progress.label).toBe('Loading...');
    });

    it('should update wizard progress', () => {
      setWizardProgress(25, 'Step 1');
      setWizardProgress(75, 'Step 3');

      const progress = getWizardProgress();
      expect(progress.value).toBe(75);
      expect(progress.label).toBe('Step 3');
    });
  });

  describe('nick management', () => {
    it('should set nick', () => {
      setNick('TestUser');
      expect(getCurrentNick()).toBe('TestUser');
    });

    it('should update nick', () => {
      setNick('OldNick');
      setNick('NewNick');

      expect(getCurrentNick()).toBe('NewNick');
    });

    it('should handle empty nick', () => {
      setNick('');
      expect(getCurrentNick()).toBe('');
    });
  });

  describe('server management', () => {
    it('should set server', () => {
      const server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.com:6667'],
      };

      useSettingsStore.getState().setServer(server);
      expect(useSettingsStore.getState().server).toEqual(server);
    });

    it('should set password required status', () => {
      setIsPasswordRequired(true);
      expect(getIsPasswordRequired()).toBe(true);

      setIsPasswordRequired(false);
      expect(getIsPasswordRequired()).toBe(false);
    });
  });

  describe('channel management', () => {
    it('should get current channel name', () => {
      expect(getCurrentChannelName()).toBe('Status');
    });

    it('should get current channel category', () => {
      expect(getCurrentChannelCategory()).toBe(ChannelCategory.status);
    });

    it('should set channel types', () => {
      setChannelTypes(['#', '&']);
      expect(getChannelTypes()).toEqual(['#', '&']);
    });

    it('should return default channel types when empty', () => {
      setChannelTypes([]);
      // Should return defaultChannelTypes from config
      expect(getChannelTypes()).toBeDefined();
    });
  });

  describe('theme management', () => {
    it('should set theme to modern', () => {
      setTheme('modern');
      expect(useSettingsStore.getState().theme).toBe('modern');
    });

    it('should set theme to classic', () => {
      setTheme('classic');
      expect(useSettingsStore.getState().theme).toBe('classic');
    });

    it('should toggle theme', () => {
      setTheme('modern');
      expect(useSettingsStore.getState().theme).toBe('modern');

      setTheme('classic');
      expect(useSettingsStore.getState().theme).toBe('classic');
    });
  });

  describe('modes management', () => {
    it('should set user modes', () => {
      const modes = [
        { symbol: '@', flag: 'o' },
        { symbol: '+', flag: 'v' },
      ];

      setUserModes(modes);
      expect(getUserModes()).toEqual(modes);
    });

    it('should set channel modes', () => {
      const modes = {
        A: ['b', 'e', 'I'],
        B: ['k'],
        C: ['l'],
        D: ['i', 'm', 'n', 's', 't'],
      };

      setChannelModes(modes);
      expect(getChannelModes()).toEqual(modes);
    });

    it('should update user modes', () => {
      setUserModes([{ symbol: '@', flag: 'o' }]);
      setUserModes([{ symbol: '+', flag: 'v' }]);

      expect(getUserModes()).toEqual([{ symbol: '+', flag: 'v' }]);
    });
  });

  describe('list request', () => {
    it('should set list request remaining seconds', () => {
      setListRequestRemainingSeconds(60);
      expect(useSettingsStore.getState().listRequestRemainingSeconds).toBe(60);
    });

    it('should handle negative value', () => {
      setListRequestRemainingSeconds(-1);
      expect(useSettingsStore.getState().listRequestRemainingSeconds).toBe(-1);
    });
  });

  describe('supported options', () => {
    it('should add supported option', () => {
      setSupportedOption('WHOX');
      expect(isSupportedOption('WHOX')).toBe(true);
    });

    it('should return false for unsupported option', () => {
      expect(isSupportedOption('UNKNOWN')).toBe(false);
    });

    it('should accumulate supported options', () => {
      setSupportedOption('WHOX');
      setSupportedOption('MONITOR');
      setSupportedOption('WATCH');

      expect(isSupportedOption('WHOX')).toBe(true);
      expect(isSupportedOption('MONITOR')).toBe(true);
      expect(isSupportedOption('WATCH')).toBe(true);
    });
  });

  describe('current user flags', () => {
    it('should add flag to current user', () => {
      setCurrentUserFlag('r', true);
      expect(getCurrentUserFlags()).toContain('r');
    });

    it('should remove flag from current user', () => {
      setCurrentUserFlag('r', true);
      setCurrentUserFlag('r', false);

      expect(getCurrentUserFlags()).not.toContain('r');
    });

    it('should handle multiple flags', () => {
      setCurrentUserFlag('r', true);
      setCurrentUserFlag('x', true);
      setCurrentUserFlag('i', true);

      const flags = getCurrentUserFlags();
      expect(flags).toContain('r');
      expect(flags).toContain('x');
      expect(flags).toContain('i');
    });

    it('should remove specific flag only', () => {
      setCurrentUserFlag('r', true);
      setCurrentUserFlag('x', true);
      setCurrentUserFlag('r', false);

      const flags = getCurrentUserFlags();
      expect(flags).not.toContain('r');
      expect(flags).toContain('x');
    });
  });

  describe('limits', () => {
    it('should set and get watch limit', () => {
      setWatchLimit(100);
      expect(getWatchLimit()).toBe(100);
    });

    it('should set and get monitor limit', () => {
      setMonitorLimit(200);
      expect(getMonitorLimit()).toBe(200);
    });

    it('should set and get silence limit', () => {
      setSilenceLimit(50);
      expect(getSilenceLimit()).toBe(50);
    });

    it('should default limits to 0', () => {
      expect(getWatchLimit()).toBe(0);
      expect(getMonitorLimit()).toBe(0);
      expect(getSilenceLimit()).toBe(0);
    });
  });

  describe('immutability', () => {
    it('should not mutate supported options array', () => {
      setSupportedOption('WHOX');
      const optionsBefore = useSettingsStore.getState().supportedOptions;

      setSupportedOption('MONITOR');
      const optionsAfter = useSettingsStore.getState().supportedOptions;

      expect(optionsBefore).not.toBe(optionsAfter);
    });

    it('should not mutate current user flags array', () => {
      setCurrentUserFlag('r', true);
      const flagsBefore = useSettingsStore.getState().currentUserFlags;

      setCurrentUserFlag('x', true);
      const flagsAfter = useSettingsStore.getState().currentUserFlags;

      expect(flagsBefore).not.toBe(flagsAfter);
    });
  });

  describe('setIsAutoAway', () => {
    it('should set isAutoAway to true', () => {
      useSettingsStore.getState().setIsAutoAway(true);

      expect(useSettingsStore.getState().isAutoAway).toBe(true);
    });

    it('should set isAutoAway to false', () => {
      useSettingsStore.getState().setIsAutoAway(true);
      useSettingsStore.getState().setIsAutoAway(false);

      expect(useSettingsStore.getState().isAutoAway).toBe(false);
    });

    it('should reset isAutoAway on resetWizardState', () => {
      useSettingsStore.getState().setIsAutoAway(true);
      useSettingsStore.getState().resetWizardState();

      expect(useSettingsStore.getState().isAutoAway).toBe(false);
    });
  });

  describe('dark mode', () => {
    it('should set isDarkMode to true', () => {
      setIsDarkMode(true);
      expect(getIsDarkMode()).toBe(true);
    });

    it('should set isDarkMode to false', () => {
      setIsDarkMode(true);
      setIsDarkMode(false);
      expect(getIsDarkMode()).toBe(false);
    });

    it('should toggle dark mode', () => {
      expect(getIsDarkMode()).toBe(false);

      toggleDarkMode();
      expect(getIsDarkMode()).toBe(true);

      toggleDarkMode();
      expect(getIsDarkMode()).toBe(false);
    });

    it('should reset isDarkMode on resetWizardState', () => {
      setIsDarkMode(true);
      useSettingsStore.getState().resetWizardState();

      expect(getIsDarkMode()).toBe(false);
    });
  });

  describe('hide avatars in users list', () => {
    it('should set hideAvatarsInUsersList to true', () => {
      setHideAvatarsInUsersList(true);
      expect(getHideAvatarsInUsersList()).toBe(true);
    });

    it('should set hideAvatarsInUsersList to false', () => {
      setHideAvatarsInUsersList(true);
      setHideAvatarsInUsersList(false);
      expect(getHideAvatarsInUsersList()).toBe(false);
    });

    it('should default hideAvatarsInUsersList to false', () => {
      expect(getHideAvatarsInUsersList()).toBe(false);
    });

    it('should reset hideAvatarsInUsersList on resetWizardState', () => {
      setHideAvatarsInUsersList(true);
      useSettingsStore.getState().resetWizardState();

      expect(getHideAvatarsInUsersList()).toBe(false);
    });
  });

  describe('font size', () => {
    it('should set fontSize to small', () => {
      setFontSize('small');
      expect(getFontSize()).toBe('small');
    });

    it('should set fontSize to medium', () => {
      setFontSize('small');
      setFontSize('medium');
      expect(getFontSize()).toBe('medium');
    });

    it('should set fontSize to large', () => {
      setFontSize('large');
      expect(getFontSize()).toBe('large');
    });

    it('should default fontSize to medium', () => {
      expect(getFontSize()).toBe('medium');
    });

    it('should reset fontSize on resetWizardState', () => {
      setFontSize('large');
      useSettingsStore.getState().resetWizardState();

      expect(getFontSize()).toBe('medium');
    });
  });

  describe('current user homepage', () => {
    it('should set currentUserHomepage', () => {
      setCurrentUserHomepage('https://example.com');
      expect(getCurrentUserHomepage()).toBe('https://example.com');
    });

    it('should clear currentUserHomepage with undefined', () => {
      setCurrentUserHomepage('https://example.com');
      setCurrentUserHomepage(undefined);
      expect(getCurrentUserHomepage()).toBeUndefined();
    });

    it('should default currentUserHomepage to undefined', () => {
      expect(getCurrentUserHomepage()).toBeUndefined();
    });

    it('should reset currentUserHomepage on resetWizardState', () => {
      setCurrentUserHomepage('https://example.com');
      useSettingsStore.getState().resetWizardState();

      expect(getCurrentUserHomepage()).toBeUndefined();
    });
  });

  describe('current user color', () => {
    it('should set currentUserColor', () => {
      setCurrentUserColor('#ff5500');
      expect(getCurrentUserColor()).toBe('#ff5500');
    });

    it('should clear currentUserColor with undefined', () => {
      setCurrentUserColor('#ff5500');
      setCurrentUserColor(undefined);
      expect(getCurrentUserColor()).toBeUndefined();
    });

    it('should default currentUserColor to undefined', () => {
      expect(getCurrentUserColor()).toBeUndefined();
    });

    it('should reset currentUserColor on resetWizardState', () => {
      setCurrentUserColor('#ff5500');
      useSettingsStore.getState().resetWizardState();

      expect(getCurrentUserColor()).toBeUndefined();
    });
  });
});
