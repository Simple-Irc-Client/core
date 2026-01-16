import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  useSettingsStore,
  setCreatorCompleted,
  setIsConnecting,
  setIsConnected,
  setConnectedTime,
  setNick,
  setCreatorStep,
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
  getIsCreatorCompleted,
  getIsPasswordRequired,
  setSupportedOption,
  isSupportedOption,
  setCreatorProgress,
  getCreatorProgress,
  setCurrentUserFlag,
  getCurrentUserFlags,
  setWatchLimit,
  setMonitorLimit,
  getWatchLimit,
  getMonitorLimit,
  setSilenceLimit,
  getSilenceLimit,
} from '../settings';
import { ChannelCategory } from '../../types';

vi.mock('../channels', () => ({
  getMessages: vi.fn(() => []),
  getTopic: vi.fn(() => ''),
  getTyping: vi.fn(() => []),
  setClearUnreadMessages: vi.fn(),
}));

vi.mock('../current', () => ({
  useCurrentStore: {
    getState: () => ({
      setUpdateTopic: vi.fn(),
      setUpdateMessages: vi.fn(),
      setUpdateUsers: vi.fn(),
      setUpdateTyping: vi.fn(),
    }),
  },
}));

vi.mock('../users', () => ({
  getUsersFromChannelSortedByMode: vi.fn(() => []),
}));

describe('settings store', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      isConnecting: false,
      isConnected: false,
      isCreatorCompleted: false,
      creatorStep: 'nick',
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
      creatorProgress: { value: 0, label: '' },
      currentUserFlags: [],
      watchLimit: 0,
      monitorLimit: 0,
      silenceLimit: 0,
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

  describe('creator state', () => {
    it('should set creator completed status', () => {
      setCreatorCompleted(true);
      expect(getIsCreatorCompleted()).toBe(true);

      setCreatorCompleted(false);
      expect(getIsCreatorCompleted()).toBe(false);
    });

    it('should set creator step', () => {
      setCreatorStep('server');
      expect(useSettingsStore.getState().creatorStep).toBe('server');

      setCreatorStep('loading');
      expect(useSettingsStore.getState().creatorStep).toBe('loading');

      setCreatorStep('password');
      expect(useSettingsStore.getState().creatorStep).toBe('password');

      setCreatorStep('channels');
      expect(useSettingsStore.getState().creatorStep).toBe('channels');
    });

    it('should set creator progress', () => {
      setCreatorProgress(50, 'Loading...');

      const progress = getCreatorProgress();
      expect(progress.value).toBe(50);
      expect(progress.label).toBe('Loading...');
    });

    it('should update creator progress', () => {
      setCreatorProgress(25, 'Step 1');
      setCreatorProgress(75, 'Step 3');

      const progress = getCreatorProgress();
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
});
