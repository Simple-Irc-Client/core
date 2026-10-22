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

    describe('with event playback', () => {
      const mockStateChanges = () => ({
        setAddUser: vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {}),
        setRemoveUser: vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {}),
        setQuitUser: vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {}),
        setRenameUser: vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {}),
        setUpdateUserFlag: vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {}),
        setUserAway: vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {}),
        setTopic: vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {}),
        setRenameChannel: vi.spyOn(channelsFile, 'setRenameChannel').mockImplementation(() => {}),
        setRemoveChannel: vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {}),
        setCurrentChannelName: vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {}),
        setNick: vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {}),
        requestLatestHistory: vi.spyOn(chatHistoryFile, 'requestLatestHistory').mockImplementation(() => {}),
      });

      it('should show replayed channel events in the window without applying them', () => {
        const mocks = mockReplayEnvironment();
        const changes = mockStateChanges();
        vi.spyOn(channelsFile, 'getChannel').mockImplementation(() => ({ name: '#Channel' }) as ReturnType<typeof channelsFile.getChannel>);

        replay('#channel', [
          'msgid=e1;time=2023-02-12T02:00:00.000Z :MyNick!~u@host JOIN #channel',
          'msgid=e2;time=2023-02-12T02:01:00.000Z :Friend!~u@host JOIN #channel',
          'msgid=e3;time=2023-02-12T02:02:00.000Z :Friend!~u@host TOPIC #channel :old topic',
          'msgid=e4;time=2023-02-12T02:03:00.000Z :Op!~u@host MODE #channel +o-v Friend Friend',
          'msgid=e5;time=2023-02-12T02:04:00.000Z :Friend!~u@host NICK Friend2',
          'msgid=e6;time=2023-02-12T02:05:00.000Z :Friend2!~u@host PART #channel later',
          'msgid=e7;time=2023-02-12T02:06:00.000Z :Op!~u@host KICK #channel Other bye',
          'msgid=e8;time=2023-02-12T02:07:00.000Z :Other!~u@host QUIT :gone',
        ]);

        expect(mocks.setAddHistoryPage).toHaveBeenCalledExactlyOnceWith([
          expect.objectContaining({ id: 'e1', target: '#channel', category: MessageCategory.join }),
          expect.objectContaining({ id: 'e2', target: '#channel', category: MessageCategory.join }),
          expect.objectContaining({ id: 'e3', target: '#channel', message: expect.stringContaining('old topic') }),
          expect.objectContaining({ id: 'e4-0', target: '#channel', category: MessageCategory.mode }),
          expect.objectContaining({ id: 'e4-1', target: '#channel', category: MessageCategory.mode }),
          expect.objectContaining({ id: 'e5', target: '#channel', message: expect.stringContaining('Friend2') }),
          expect.objectContaining({ id: 'e6', target: '#channel', category: MessageCategory.part }),
          expect.objectContaining({ id: 'e7', target: '#channel', category: MessageCategory.kick }),
          expect.objectContaining({ id: 'e8', target: '#channel', category: MessageCategory.quit }),
        ], undefined);
        for (const change of Object.values(changes)) {
          expect(change).not.toHaveBeenCalled();
        }
        expect(mocks.ircSendRawMessage).not.toHaveBeenCalled();
      });

      it('should keep a replayed kick of us in the channel it happened in', () => {
        const mocks = mockReplayEnvironment();
        const changes = mockStateChanges();

        replay('#channel', ['msgid=k1;time=2023-02-12T02:00:00.000Z :Op!~u@host KICK #channel MyNick :out']);

        expect(mocks.setAddHistoryPage).toHaveBeenCalledWith([expect.objectContaining({ id: 'k1', target: '#channel', category: MessageCategory.kick })], undefined);
        expect(changes.setRemoveChannel).not.toHaveBeenCalled();
        expect(changes.setCurrentChannelName).not.toHaveBeenCalled();
      });

      it('should show a replayed quit in the window it was replayed for', () => {
        const mocks = mockReplayEnvironment();
        mockStateChanges();

        replay('Friend', ['msgid=q1;time=2023-02-12T02:00:00.000Z :Friend!~u@host QUIT :gone']);

        expect(mocks.setAddHistoryPage).toHaveBeenCalledWith([expect.objectContaining({ id: 'q1', target: 'Friend' })], undefined);
      });

      it('should not apply events history does not show', () => {
        const mocks = mockReplayEnvironment();
        const changes = mockStateChanges();

        replay('#channel', ['msgid=a1;time=2023-02-12T02:00:00.000Z :Friend!~u@host AWAY :lunch']);

        expect(changes.setUserAway).not.toHaveBeenCalled();
        expect(mocks.setAddHistoryPage).toHaveBeenCalledWith([], undefined);
      });

      it('should give a live mode change the ids its replay will carry', () => {
        mockReplayEnvironment();
        mockStateChanges();
        const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        new Kernel({ type: 'raw', line: '@msgid=m1;time=2023-02-12T02:00:00.000Z :Op!~u@host MODE #channel +o-v Friend Friend' }).handle();

        expect(setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1-0', target: '#channel' }));
        expect(setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1-1', target: '#channel' }));
      });
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
