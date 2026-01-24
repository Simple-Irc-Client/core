import { describe, expect, it, beforeEach } from 'vitest';
import {
  useChannelSettingsStore,
  setChannelSettingsChannelName,
  setChannelSettingsModes,
  updateChannelSettingsMode,
  getChannelSettingsModes,
  addToChannelSettingsBanList,
  addToChannelSettingsExceptionList,
  addToChannelSettingsInviteList,
  setChannelSettingsBanList,
  setChannelSettingsExceptionList,
  setChannelSettingsInviteList,
  setChannelSettingsIsLoading,
  setChannelSettingsIsBanListLoading,
  setChannelSettingsIsExceptionListLoading,
  setChannelSettingsIsInviteListLoading,
  clearChannelSettingsStore,
  type ListEntry,
} from '../channelSettings';

describe('channelSettings store', () => {
  beforeEach(() => {
    clearChannelSettingsStore();
  });

  describe('channel name', () => {
    it('should set channel name', () => {
      setChannelSettingsChannelName('#test');
      expect(useChannelSettingsStore.getState().channelName).toBe('#test');
    });
  });

  describe('channel modes', () => {
    it('should set channel modes', () => {
      const modes = { n: true, t: true, l: '50' };
      setChannelSettingsModes(modes);
      expect(getChannelSettingsModes()).toEqual(modes);
    });

    it('should update a single channel mode with boolean', () => {
      setChannelSettingsModes({ n: true });
      updateChannelSettingsMode('t', true);
      expect(getChannelSettingsModes()).toEqual({ n: true, t: true });
    });

    it('should update a single channel mode with string', () => {
      setChannelSettingsModes({ n: true });
      updateChannelSettingsMode('l', '100');
      expect(getChannelSettingsModes()).toEqual({ n: true, l: '100' });
    });

    it('should remove mode when set to null', () => {
      setChannelSettingsModes({ n: true, t: true });
      updateChannelSettingsMode('n', null);
      expect(getChannelSettingsModes()).toEqual({ t: true });
    });

    it('should remove mode when set to false', () => {
      setChannelSettingsModes({ n: true, t: true });
      updateChannelSettingsMode('n', false);
      expect(getChannelSettingsModes()).toEqual({ t: true });
    });
  });

  describe('ban list', () => {
    const banEntry: ListEntry = { mask: '*!*@bad.host', setBy: 'admin', setTime: 1234567890 };

    it('should set ban list', () => {
      setChannelSettingsBanList([banEntry]);
      expect(useChannelSettingsStore.getState().banList).toEqual([banEntry]);
    });

    it('should add to ban list', () => {
      addToChannelSettingsBanList(banEntry);
      expect(useChannelSettingsStore.getState().banList).toEqual([banEntry]);
    });

    it('should accumulate ban entries', () => {
      const entry2: ListEntry = { mask: '*!*@other.host', setBy: 'mod', setTime: 1234567891 };
      addToChannelSettingsBanList(banEntry);
      addToChannelSettingsBanList(entry2);
      expect(useChannelSettingsStore.getState().banList).toHaveLength(2);
    });

    it('should remove from ban list', () => {
      setChannelSettingsBanList([banEntry]);
      useChannelSettingsStore.getState().removeFromBanList('*!*@bad.host');
      expect(useChannelSettingsStore.getState().banList).toEqual([]);
    });
  });

  describe('exception list', () => {
    const exceptionEntry: ListEntry = { mask: '*!*@good.host', setBy: 'admin', setTime: 1234567890 };

    it('should set exception list', () => {
      setChannelSettingsExceptionList([exceptionEntry]);
      expect(useChannelSettingsStore.getState().exceptionList).toEqual([exceptionEntry]);
    });

    it('should add to exception list', () => {
      addToChannelSettingsExceptionList(exceptionEntry);
      expect(useChannelSettingsStore.getState().exceptionList).toEqual([exceptionEntry]);
    });

    it('should remove from exception list', () => {
      setChannelSettingsExceptionList([exceptionEntry]);
      useChannelSettingsStore.getState().removeFromExceptionList('*!*@good.host');
      expect(useChannelSettingsStore.getState().exceptionList).toEqual([]);
    });
  });

  describe('invite list', () => {
    const inviteEntry: ListEntry = { mask: '*!*@invited.host', setBy: 'admin', setTime: 1234567890 };

    it('should set invite list', () => {
      setChannelSettingsInviteList([inviteEntry]);
      expect(useChannelSettingsStore.getState().inviteList).toEqual([inviteEntry]);
    });

    it('should add to invite list', () => {
      addToChannelSettingsInviteList(inviteEntry);
      expect(useChannelSettingsStore.getState().inviteList).toEqual([inviteEntry]);
    });

    it('should remove from invite list', () => {
      setChannelSettingsInviteList([inviteEntry]);
      useChannelSettingsStore.getState().removeFromInviteList('*!*@invited.host');
      expect(useChannelSettingsStore.getState().inviteList).toEqual([]);
    });
  });

  describe('loading states', () => {
    it('should set isLoading', () => {
      setChannelSettingsIsLoading(true);
      expect(useChannelSettingsStore.getState().isLoading).toBe(true);
      setChannelSettingsIsLoading(false);
      expect(useChannelSettingsStore.getState().isLoading).toBe(false);
    });

    it('should set isBanListLoading', () => {
      setChannelSettingsIsBanListLoading(true);
      expect(useChannelSettingsStore.getState().isBanListLoading).toBe(true);
    });

    it('should set isExceptionListLoading', () => {
      setChannelSettingsIsExceptionListLoading(true);
      expect(useChannelSettingsStore.getState().isExceptionListLoading).toBe(true);
    });

    it('should set isInviteListLoading', () => {
      setChannelSettingsIsInviteListLoading(true);
      expect(useChannelSettingsStore.getState().isInviteListLoading).toBe(true);
    });
  });

  describe('active tab', () => {
    it('should set active tab', () => {
      useChannelSettingsStore.getState().setActiveTab('lists');
      expect(useChannelSettingsStore.getState().activeTab).toBe('lists');
    });

    it('should set active list type', () => {
      useChannelSettingsStore.getState().setActiveListType('e');
      expect(useChannelSettingsStore.getState().activeListType).toBe('e');
    });
  });

  describe('clearStore', () => {
    it('should reset all state to initial values', () => {
      // Set some values
      setChannelSettingsChannelName('#test');
      setChannelSettingsModes({ n: true, t: true });
      addToChannelSettingsBanList({ mask: '*!*@test', setBy: 'admin', setTime: 123 });
      setChannelSettingsIsLoading(true);
      useChannelSettingsStore.getState().setActiveTab('lists');

      // Clear store
      clearChannelSettingsStore();

      // Verify reset
      const state = useChannelSettingsStore.getState();
      expect(state.channelName).toBe('');
      expect(state.channelModes).toEqual({});
      expect(state.banList).toEqual([]);
      expect(state.exceptionList).toEqual([]);
      expect(state.inviteList).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.activeTab).toBe('modes');
      expect(state.activeListType).toBe('b');
    });
  });
});
