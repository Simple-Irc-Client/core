/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import * as networkFile from '@/network/irc/network';
import { ChannelCategory } from '@shared/types';
import { resetDmPresenceSubscription, subscribeDmPresence } from '@features/dmPresence/dmPresence';
import { clearMonitorList, isNickMonitored, isNickOnline } from '@features/monitor/store/monitor';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel ircv3/monitor', () => {
  setupKernelTest();

  describe('DM presence (MONITOR/WATCH for open DM windows)', () => {
    beforeEach(() => {
      clearMonitorList();
      resetDmPresenceSubscription();
    });

    afterEach(() => {
      clearMonitorList();
    });

    it('subscribes MONITOR for a new incoming private message', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).toHaveBeenCalledWith(['OtherUser']);
      expect(isNickMonitored('OtherUser')).toBe(true);
    });

    it('subscribes MONITOR for CTCP ACTION in a private message', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :\x01ACTION waves\x01';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).toHaveBeenCalledWith(['OtherUser']);
      expect(isNickMonitored('OtherUser')).toBe(true);
    });

    it('subscribes MONITOR when a typing notification (TAGMSG) arrives before any message', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});

      const line = '@+draft/typing=active;+typing=active;msgid=abc123;time=2023-03-04T19:16:23.158Z :Bob!~bob@host TAGMSG MyNick';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).toHaveBeenCalledWith(['Bob']);
      expect(isNickMonitored('Bob')).toBe(true);
    });

    it('does not subscribe anything for a regular channel message', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#test');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});

      // This is a channel message, not a private message
      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(isNickMonitored('OtherUser')).toBe(false);
    });

    it('does not resubscribe MONITOR when the DM window already exists', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => 'OtherUser');
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :Hello again';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).not.toHaveBeenCalled();
    });

    it('does not touch MONITOR/WATCH subscriptions when someone JOINs a channel', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      const mockMonitorRemove = vi.spyOn(networkFile, 'ircMonitorRemove').mockImplementation(() => {});

      const line = ':OtherUser!~user@host JOIN #channel1';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });

    it('does not touch MONITOR/WATCH subscriptions when someone PARTs a channel', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      const mockMonitorRemove = vi.spyOn(networkFile, 'ircMonitorRemove').mockImplementation(() => {});

      const line = ':OtherUser!~user@host PART #channel1 :bye';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });

    it('does not touch MONITOR/WATCH subscriptions when someone is KICKed from a channel', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      const mockMonitorRemove = vi.spyOn(networkFile, 'ircMonitorRemove').mockImplementation(() => {});

      const line = ':Op!~op@host KICK #channel1 OtherUser :bye';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });

    it('flips a DM-subscribed nick online on RPL_MONONLINE (730)', () => {
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      subscribeDmPresence('OtherUser');
      expect(isNickOnline('OtherUser')).toBe(false);

      new Kernel({ type: 'raw', line: ':irc.example.net 730 MyNick :OtherUser!user@host' }).handle();

      expect(isNickOnline('OtherUser')).toBe(true);
    });

    it('flips a DM-subscribed nick back offline on RPL_MONOFFLINE (731)', () => {
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      subscribeDmPresence('OtherUser');
      new Kernel({ type: 'raw', line: ':irc.example.net 730 MyNick :OtherUser!user@host' }).handle();
      expect(isNickOnline('OtherUser')).toBe(true);

      new Kernel({ type: 'raw', line: ':irc.example.net 731 MyNick :OtherUser' }).handle();

      expect(isNickOnline('OtherUser')).toBe(false);
    });

    it('clears all presence state on a natural disconnect (close event) instead of leaving stale online/offline dots', () => {
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      subscribeDmPresence('OtherUser');
      new Kernel({ type: 'raw', line: ':irc.example.net 730 MyNick :OtherUser!user@host' }).handle();
      expect(isNickOnline('OtherUser')).toBe(true);

      // The socket is gone: the server's MONITOR list died with it, so the
      // last-known online/offline flags can no longer be vouched for.
      vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'clearAllTyping').mockImplementation(() => {});

      new Kernel({ type: 'close' }).handle();

      expect(isNickMonitored('OtherUser')).toBe(false);
      expect(isNickOnline('OtherUser')).toBe(false);
    });

    it('follows a peer renaming (NICK): the open DM window and its MONITOR subscription both move to the new nick', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => []);
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      const mockMonitorRemove = vi.spyOn(networkFile, 'ircMonitorRemove').mockImplementation(() => {});

      channelsFile.setAddChannel('OtherUser', ChannelCategory.priv);
      subscribeDmPresence('OtherUser');
      mockMonitorAdd.mockClear();

      const line = '@msgid=abc;time=2023-02-12T14:20:53.072Z :OtherUser!user@host NICK :OtherUser2';
      new Kernel({ type: 'raw', line }).handle();

      expect(channelsFile.existChannel('OtherUser')).toBe(false);
      expect(channelsFile.existChannel('OtherUser2')).toBe(true);
      expect(mockMonitorRemove).toHaveBeenCalledWith(['OtherUser']);
      expect(mockMonitorAdd).toHaveBeenCalledWith(['OtherUser2']);
      expect(isNickMonitored('OtherUser')).toBe(false);
      expect(isNickMonitored('OtherUser2')).toBe(true);

      channelsFile.setRemoveChannel('OtherUser2');
    });

    it('flips a DM-subscribed nick offline immediately on QUIT, without waiting for RPL_MONOFFLINE', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      subscribeDmPresence('mero');
      new Kernel({ type: 'raw', line: ':irc.example.net 730 MyNick :mero!~mero@host' }).handle();
      expect(isNickOnline('mero')).toBe(true);

      const line = '@msgid=abc;time=2023-03-11T00:52:21.568Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP QUIT :Quit: Leaving';
      new Kernel({ type: 'raw', line }).handle();

      expect(isNickOnline('mero')).toBe(false);
    });

    it('a NICK from someone with no open DM window and no friend entry does not touch MONITOR', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1']);
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
      const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});
      const mockMonitorRemove = vi.spyOn(networkFile, 'ircMonitorRemove').mockImplementation(() => {});

      const line = '@msgid=abc;time=2023-02-12T14:20:53.072Z :ChannelOnlyUser!user@host NICK :ChannelOnlyUser2';
      new Kernel({ type: 'raw', line }).handle();

      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });
  });
});
