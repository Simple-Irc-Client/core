/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import * as awayMessagesFile from '@features/channels/store/awayMessages';
import * as settingsFile from '@features/settings/store/settings';
import * as usersFile from '@features/users/store/users';
import * as networkFile from '@/network/irc/network';
import * as notificationsFile from '@/runtime/notifications';
import * as chatHistoryFile from '@/network/irc/chatHistory';
import { DEBUG_CHANNEL } from '@/config/config';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import { clearReadMarkers } from '@/network/irc/readMarkers';
import { type Message, MessageCategory } from '@shared/types';
import { defaultUserModes, setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel ircv3/batch', () => {
  setupKernelTest();

  it('test raw BATCH', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  describe('chathistory replay', () => {
    const mockReplayEnvironment = () => {
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current');
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => ['away']);
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      return {
        setAddHistoryPage: vi.spyOn(channelsFile, 'setAddHistoryPage').mockImplementation(() => {}),
        setIncreaseUnreadMessages: vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {}),
        setHasMention: vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {}),
        setTyping: vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {}),
        notifyHighlight: vi.spyOn(notificationsFile, 'notifyHighlight').mockImplementation(async () => {}),
        addAwayMessage: vi.spyOn(awayMessagesFile, 'addAwayMessage').mockImplementation(() => {}),
        ircSendRawMessage: vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {}),
      };
    };

    const replay = (target: string, lines: string[]): void => {
      new Kernel({ type: 'raw', line: `:ergo.test BATCH +hist chathistory ${target}` }).handle();
      for (const line of lines) {
        new Kernel({ type: 'raw', line: `@batch=hist;${line}` }).handle();
      }
      new Kernel({ type: 'raw', line: ':ergo.test BATCH -hist' }).handle();
    };

    it('should show a replayed mention as highlighted without notifying or counting it as unread', () => {
      const mocks = mockReplayEnvironment();

      replay('#channel', ['msgid=h1;time=2023-02-12T02:06:12.210Z :Friend!~u@host PRIVMSG #channel :hey MyNick']);

      expect(mocks.setAddHistoryPage).toHaveBeenCalledWith([expect.objectContaining({ id: 'h1', target: '#channel', message: 'hey MyNick', highlight: true })], undefined);
      expect(mocks.notifyHighlight).not.toHaveBeenCalled();
      expect(mocks.setHasMention).not.toHaveBeenCalled();
      expect(mocks.setIncreaseUnreadMessages).not.toHaveBeenCalled();
      expect(mocks.addAwayMessage).not.toHaveBeenCalled();
      expect(mocks.setTyping).not.toHaveBeenCalled();
    });

    it('should show a replayed ACTION mention without notifying or counting it as unread', () => {
      const mocks = mockReplayEnvironment();

      replay('#channel', ['msgid=h2;time=2023-02-12T02:06:12.210Z :Friend!~u@host PRIVMSG #channel :\x01ACTION pokes MyNick\x01']);

      expect(mocks.setAddHistoryPage).toHaveBeenCalledWith([expect.objectContaining({ id: 'h2', message: 'pokes MyNick', highlight: true })], undefined);
      expect(mocks.notifyHighlight).not.toHaveBeenCalled();
      expect(mocks.setIncreaseUnreadMessages).not.toHaveBeenCalled();
    });

    it('should not answer a replayed CTCP request', () => {
      const mocks = mockReplayEnvironment();

      replay('#channel', ['msgid=h3;time=2023-02-12T02:06:12.210Z :Friend!~u@host PRIVMSG #channel :\x01VERSION\x01']);

      expect(mocks.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should not act on a replayed NickServ password request', () => {
      mockReplayEnvironment();
      const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
      const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

      replay('NickServ', ['msgid=h4;time=2023-02-12T02:06:12.210Z :NickServ!NickServ@services NOTICE MyNick :This nickname is registered and protected.']);

      expect(mockSetIsPasswordRequired).not.toHaveBeenCalled();
      expect(mockSetWizardStep).not.toHaveBeenCalled();
    });

    it('should still notify for the same mention arriving live', () => {
      const mocks = mockReplayEnvironment();

      new Kernel({ type: 'raw', line: '@msgid=l1;time=2023-02-12T02:06:12.210Z :Friend!~u@host PRIVMSG #channel :hey MyNick' }).handle();

      expect(mocks.notifyHighlight).toHaveBeenCalledTimes(1);
      expect(mocks.setIncreaseUnreadMessages).toHaveBeenCalledWith('#channel');
    });

    it('should place a page in one go and report its size and oldest message', () => {
      const mocks = mockReplayEnvironment();
      const onHistoryBatch = vi.spyOn(chatHistoryFile, 'onHistoryBatch').mockImplementation(() => {});

      replay('#channel', [
        'msgid=p1;time=2023-02-12T02:00:00.000Z :Friend!~u@host PRIVMSG #channel :first',
        '+typing=active;time=2023-02-12T02:00:30.000Z :Friend!~u@host TAGMSG #channel',
        'msgid=p2;time=2023-02-12T02:01:00.000Z :Friend!~u@host PRIVMSG #channel :second',
      ]);

      expect(mocks.setAddHistoryPage).toHaveBeenCalledExactlyOnceWith([
        expect.objectContaining({ id: 'p1', message: 'first' }),
        expect.objectContaining({ id: 'p2', message: 'second' }),
      ], undefined);
      expect(onHistoryBatch).toHaveBeenCalledExactlyOnceWith('#channel', 3, { time: Date.parse('2023-02-12T02:00:00.000Z'), msgid: 'p1' });
    });

    describe('with a read marker', () => {
      beforeEach(() => {
        clearReadMarkers();
        resetCapabilityState();
        markCapabilitiesAcknowledged(['draft/read-marker']);
      });

      const replayed = (id: string, time: string, highlight = false): Message =>
        ({ id, message: 'text', nick: 'Friend', target: '#channel', time, category: MessageCategory.default, highlight });

      it('should count replayed messages after the marker as unread', () => {
        const mocks = mockReplayEnvironment();
        const setUnreadMessages = vi.spyOn(channelsFile, 'setUnreadMessages').mockImplementation(() => {});
        vi.spyOn(channelsFile, 'getMessages').mockImplementation(() => [
          replayed('h5', '2023-02-12T02:00:00.000Z'),
          replayed('h6', '2023-02-12T02:10:00.000Z', true),
        ]);

        new Kernel({ type: 'raw', line: ':ergo.test MARKREAD #channel timestamp=2023-02-12T02:05:00.000Z' }).handle();
        replay('#channel', [
          'msgid=h5;time=2023-02-12T02:00:00.000Z :Friend!~u@host PRIVMSG #channel :read on the phone',
          'msgid=h6;time=2023-02-12T02:10:00.000Z :Friend!~u@host PRIVMSG #channel :missed, MyNick',
        ]);

        expect(setUnreadMessages).toHaveBeenLastCalledWith('#channel', 1, true);
        expect(mocks.notifyHighlight).not.toHaveBeenCalled();
      });

      it('should mark history replayed into the window being read as read', () => {
        const mocks = mockReplayEnvironment();

        new Kernel({ type: 'raw', line: ':ergo.test MARKREAD #current timestamp=2023-02-12T02:05:00.000Z' }).handle();
        replay('#current', [
          'msgid=h7;time=2023-02-12T02:10:00.000Z :Friend!~u@host PRIVMSG #current :one',
          'msgid=h8;time=2023-02-12T02:11:00.000Z :Friend!~u@host PRIVMSG #current :two',
        ]);

        expect(mocks.ircSendRawMessage).toHaveBeenCalledExactlyOnceWith('MARKREAD #current timestamp=2023-02-12T02:11:00.000Z');
      });
    });
  });
});
