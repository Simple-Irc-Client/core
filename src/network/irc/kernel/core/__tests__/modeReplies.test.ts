/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as networksStore from '@features/networks/store/networks';
import * as channelsFile from '@features/channels/store/channels';
import * as channelSettingsFile from '@features/channels/store/channelSettings';
import { useChannelSettingsStore } from '@features/channels/store/channelSettings';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { MessageCategory } from '@shared/types';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel: channel and user mode replies', () => {
  setupKernelTest();

  beforeEach(() => {
    useChannelSettingsStore.setState({ channelName: '#sic' });
    vi.spyOn(networksStore, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(networksStore, 'getChannelModes').mockImplementation(() => ({ A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 's'] }));
    vi.spyOn(networksStore, 'getCurrentChannelName').mockImplementation(() => '#current');
  });

  const handle = (line: string) => {
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    new Kernel({ type: 'raw', line }).handle();
    return setAddMessage.mock.calls.map(([message]) => message).filter((message) => message.target !== DEBUG_CHANNEL)
      .map(({ message, target, category }) => ({ message, target, category }));
  };

  describe('324 channel modes', () => {
    it('should load the modes of the channel whose settings are open, with their parameters', () => {
      const setModes = vi.spyOn(channelSettingsFile, 'setChannelSettingsModes');

      handle(':server 324 me #sic +ntkl secret 50');

      expect(setModes).toHaveBeenCalledWith({ n: true, t: true, k: 'secret', l: '50' });
      expect(useChannelSettingsStore.getState().isLoading).toBe(false);
    });

    it('should read modes sent as the trailing parameter', () => {
      const setModes = vi.spyOn(channelSettingsFile, 'setChannelSettingsModes');

      handle(':server 324 me #sic :+nt');

      expect(setModes).toHaveBeenCalledWith({ n: true, t: true });
    });

    it('should read a last mode parameter sent as the trailing one', () => {
      const setModes = vi.spyOn(channelSettingsFile, 'setChannelSettingsModes');

      handle(':server 324 me #sic +l :50');

      expect(setModes).toHaveBeenCalledWith({ l: '50' });
    });

    it('should skip a parameter the server left out', () => {
      const setModes = vi.spyOn(channelSettingsFile, 'setChannelSettingsModes');

      handle(':server 324 me #sic +nk');

      expect(setModes).toHaveBeenCalledWith({ n: true });
    });

    it('should leave the open settings alone for another channel', () => {
      const setModes = vi.spyOn(channelSettingsFile, 'setChannelSettingsModes');

      handle(':server 324 me #other +nt');

      expect(setModes).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['ban', '367', '368', 'addToChannelSettingsBanList', 'setChannelSettingsIsBanListLoading'],
    ['invite', '346', '347', 'addToChannelSettingsInviteList', 'setChannelSettingsIsInviteListLoading'],
    ['exception', '348', '349', 'addToChannelSettingsExceptionList', 'setChannelSettingsIsExceptionListLoading'],
  ] as const)('%s list', (_list, entryNumeric, endNumeric, add, setLoading) => {
    it('should add an entry for the channel whose settings are open', () => {
      const addEntry = vi.spyOn(channelSettingsFile, add).mockImplementation(() => {});

      handle(`:server ${entryNumeric} me #sic *!*@bad.host op 1700000000`);

      expect(addEntry).toHaveBeenCalledWith({ mask: '*!*@bad.host', setBy: 'op', setTime: 1700000000 });
    });

    it('should take an entry without who set it or when', () => {
      const addEntry = vi.spyOn(channelSettingsFile, add).mockImplementation(() => {});

      handle(`:server ${entryNumeric} me #sic *!*@bad.host`);

      expect(addEntry).toHaveBeenCalledWith({ mask: '*!*@bad.host', setBy: '', setTime: 0 });
    });

    it.each([
      ['another channel', `:server ${entryNumeric} me #other *!*@bad.host op 1700000000`],
      ['no mask', `:server ${entryNumeric} me #sic`],
    ])('should ignore an entry for %s', (_case, line) => {
      const addEntry = vi.spyOn(channelSettingsFile, add).mockImplementation(() => {});

      handle(line);

      expect(addEntry).not.toHaveBeenCalled();
    });

    it('should stop loading at the end of the list', () => {
      const stopLoading = vi.spyOn(channelSettingsFile, setLoading).mockImplementation(() => {});

      handle(`:server ${endNumeric} me #sic :End of list`);

      expect(stopLoading).toHaveBeenCalledWith(false);
    });
  });

  it('should show our user modes in Status', () => {
    expect(handle(':server 221 me +iwx')).toEqual([{ message: expect.stringContaining('+iwx'), target: STATUS_CHANNEL, category: MessageCategory.info }]);
  });

  it.each([
    [':server 472 me Z :is unknown mode char to me', 'Z: is unknown mode char to me'],
    [':server 478 me #sic *!*@x :Channel ban list is full', '#sic *!*@x: Channel ban list is full'],
    [':server 501 me :Unknown MODE flag', 'Unknown MODE flag'],
    [':server 502 me :Cannot change mode for other users', 'Cannot change mode for other users'],
  ])('should show %s as an error where the command was typed', (line, message) => {
    expect(handle(line)).toEqual([{ message, target: '#current', category: MessageCategory.error }]);
  });
});
