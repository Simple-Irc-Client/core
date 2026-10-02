/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import * as networkFile from '@/network/irc/network';
import { clearChannelWhoRequests, requestChannelWho } from '@/network/irc/kernel/core/who';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/who', () => {
  setupKernelTest();

  it('test raw 354 - WHOX reply', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getHasUser').mockReturnValue(false);
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockReturnValue(defaultUserModes);

    const line = ':insomnia.pirc.pl 354 mero 152 #Religie ~pirc ukryty-88E7A1BA.adsl.inetia.pl * JAKNEK Hs 0 :Użytkownik bramki';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddUser).toHaveBeenCalledWith(expect.objectContaining({ nick: 'JAKNEK' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  describe('WHO sent after joining a channel', () => {
    beforeEach(() => {
      clearChannelWhoRequests();
      vi.spyOn(settingsFile, 'getUserModes').mockReturnValue(defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockReturnValue('#current');
    });

    it('asks for WHOX fields when the server supports WHOX', () => {
      vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation((option) => option === 'WHOX');
      const mockSend = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

      requestChannelWho('#chan');

      expect(mockSend).toHaveBeenCalledWith('WHO #chan %chtsunfra,152');
    });

    it('sends a plain WHO when the server lacks WHOX', () => {
      vi.spyOn(settingsFile, 'isSupportedOption').mockReturnValue(false);
      const mockSend = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

      requestChannelWho('#chan');

      expect(mockSend).toHaveBeenCalledWith('WHO #chan');
    });

    it('updates users from 352 replies without showing them', () => {
      vi.spyOn(settingsFile, 'isSupportedOption').mockReturnValue(false);
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getHasUser').mockReturnValue(false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetUserRealname = vi.spyOn(usersFile, 'setUserRealname').mockImplementation(() => {});
      const mockSetUserAway = vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});
      const mockSetUserAccount = vi.spyOn(usersFile, 'setUserAccount').mockImplementation(() => {});

      requestChannelWho('#Chan');
      new Kernel({ type: 'raw', line: ':server 352 me #chan ~alice host.example server alice G@ :0 Alice Example' }).handle();
      new Kernel({ type: 'raw', line: ':server 315 me #chan :End of WHO list' }).handle();

      expect(mockSetAddUser).toHaveBeenCalledWith(expect.objectContaining({
        nick: 'alice',
        ident: '~alice',
        hostname: 'host.example',
        channels: [expect.objectContaining({ name: '#chan', flags: ['@'] })],
      }));
      expect(mockSetUserRealname).toHaveBeenCalledWith('alice', 'Alice Example');
      expect(mockSetUserAway).toHaveBeenCalledWith('alice', true);
      expect(mockSetUserAccount).not.toHaveBeenCalled();
      // Debug echoes only
      expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
    });

    it('shows a later WHO for the same channel once ours has ended', () => {
      vi.spyOn(settingsFile, 'isSupportedOption').mockReturnValue(false);
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      requestChannelWho('#chan');
      new Kernel({ type: 'raw', line: ':server 315 me #chan :End of WHO list' }).handle();
      new Kernel({ type: 'raw', line: ':server 315 me #chan :End of WHO list' }).handle();

      expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ target: '#current', message: '#chan: End of WHO list' }));
    });

    it('forgets requests from a previous connection', () => {
      vi.spyOn(settingsFile, 'isSupportedOption').mockReturnValue(false);
      vi.spyOn(settingsFile, 'getCurrentNick').mockReturnValue('me');
      vi.spyOn(settingsFile, 'getServer').mockReturnValue(undefined);
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      requestChannelWho('#chan');
      new Kernel({ type: 'connect' }).handle();
      new Kernel({ type: 'raw', line: ':server 315 me #chan :End of WHO list' }).handle();

      expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ target: '#current', message: '#chan: End of WHO list' }));
    });

    it('ignores its own 352 without a nick', () => {
      vi.spyOn(settingsFile, 'isSupportedOption').mockReturnValue(false);
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});

      requestChannelWho('#chan');

      expect(() => new Kernel({ type: 'raw', line: ':server 352 me #chan ~alice host.example' }).handle()).not.toThrow();
      expect(mockSetAddUser).not.toHaveBeenCalled();
    });
  });

  describe('WHO typed by the user', () => {
    beforeEach(() => {
      clearChannelWhoRequests();
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockReturnValue('#current');
    });

    it('shows 352 and 315 in the current window without touching users', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server 352 me #chan ~alice host.example server alice H :0 Alice' }).handle();
      new Kernel({ type: 'raw', line: ':server 315 me #chan :End of WHO list' }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current', message: '#chan ~alice host.example server alice H: 0 Alice' }));
      expect(mockSetAddMessage).toHaveBeenNthCalledWith(4, expect.objectContaining({ target: '#current', message: '#chan: End of WHO list' }));
      expect(mockSetAddUser).not.toHaveBeenCalled();
    });

    it('shows a WHOX reply with another query type instead of parsing it as ours', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server 354 me alice alice_acc' }).handle();

      expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ target: '#current', message: 'alice alice_acc' }));
      expect(mockSetAddUser).not.toHaveBeenCalled();
    });
  });
});
