/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as channelListFile from '@features/channels/store/channelList';
import * as usersFile from '@features/users/store/users';
import * as networkFile from '@/network/irc/network';
import * as capabilitiesFile from '@/network/irc/capabilities';
import i18next from '@/app/i18n';
import { STATUS_CHANNEL, clientVersion } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel fuzz', () => {
  setupKernelTest();

  describe('fuzzy tests', () => {
    // Generated with fast-check: a failing line is reported with the seed that replays it, shrunk to its simplest form
    const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const text = (maxLength: number, minLength = 0) => fc.string({ unit: fc.constantFrom(...CHARS), minLength, maxLength });
    const nick = fc.tuple(fc.constantFrom('', '~', '&', '@', '%', '+'), text(15, 1)).map(([prefix, name]) => prefix + name);
    const channel = fc.tuple(fc.constantFrom('#', '&', '+', '!'), text(20, 1)).map(([prefix, name]) => prefix + name);
    const hostmask = fc.tuple(text(15, 1), text(10, 1), text(30, 1)).map(([name, ident, host]) => `${name}!~${ident}@${host}`);
    const tags = fc.array(fc.tuple(text(10, 1), text(20)), { maxLength: 4 }).map((pairs) => (pairs.length > 0 ? `@${pairs.map(([key, value]) => `${key}=${value}`).join(';')} ` : ''));
    const msgid = text(22, 22).map((id) => `@msgid=${id};time=2023-01-01T00:00:00.000Z `);
    const reason = fc.option(text(100), { nil: undefined }).map((words) => (words === undefined ? '' : ` :${words}`));

    /** The fuzz alphabet, `length` characters of it: for fixed cases that need some length */
    const filler = (length: number): string => CHARS.repeat(Math.ceil(length / CHARS.length)).slice(0, length);

    const handles = (line: string): void => {
      expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
    };

    /** Every generated line is handled without throwing */
    const handlesAll = (lines: fc.Arbitrary<string>, numRuns = 50): void => {
      fc.assert(fc.property(lines, handles), { numRuns });
    };

    // Setup common mocks for all fuzzy tests
    const setupMocks = () => {
      vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'testuser');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#test');
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setChannelModes').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setUserModes').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setChannelTypes').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setWizardProgress').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setMonitorLimit').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setSilenceLimit').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setWatchLimit').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getChannelModes').mockImplementation(() => ({ A: [], B: [], C: [], D: [] }));
      vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTopicSetBy').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'isChannel').mockImplementation((name) => name?.startsWith('#') || name?.startsWith('&'));
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserAccount').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserHost').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserRealname').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => ({ nick: 'testuser', flags: [], ident: '', hostname: '', channels: [] }));
      vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#test']);
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircRequestChatHistory').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircSendList').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'parseCapabilityList').mockImplementation(() => ({}));
      vi.spyOn(capabilitiesFile, 'addAvailableCapabilities').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'getCapabilitiesToRequest').mockImplementation(() => []);
      vi.spyOn(capabilitiesFile, 'markCapabilitiesRequested').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'markCapabilitiesAcknowledged').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'setAwaitingMoreCaps').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'endCapNegotiation').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation(() => false);
      vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});
      vi.spyOn(channelListFile, 'setChannelListClear').mockImplementation(() => {});
      vi.spyOn(channelListFile, 'setChannelListFinished').mockImplementation(() => {});
    };

    describe('random string fuzzing', () => {
      it('should not crash on completely random strings', () => {
        setupMocks();

        handlesAll(text(500, 1), 100);
        handlesAll(fc.string({ unit: 'binary', maxLength: 300 }), 100);
      });

      it('should not crash on empty and whitespace strings', () => {
        setupMocks();

        const edgeCases = ['', ' ', '  ', '\t', '\n', '\r\n', '   \t\n  ', '\0', '\x00\x01\x02'];
        for (const testCase of edgeCases) {
          expect(() => new Kernel({ type: 'raw', line: testCase }).handle()).not.toThrow();
        }
      });

      it('should not crash on unicode and special characters', () => {
        setupMocks();

        const unicodeCases = [
          '🔥🎉💻',
          'こんにちは',
          'Привет мир',
          '🏳️‍🌈',
          '\u0000\u001F\u007F',
          '©®™',
          '∞≠≤≥',
          'Ñoño',
          '\uFFFD\uFFFE\uFFFF',
        ];
        for (const testCase of unicodeCases) {
          expect(() => new Kernel({ type: 'raw', line: testCase }).handle()).not.toThrow();
        }
      });

      it('should not crash on very long strings', () => {
        setupMocks();

        const longStrings = [filler(1000), filler(5000), filler(10000), 'A'.repeat(50000)];
        for (const testCase of longStrings) {
          expect(() => new Kernel({ type: 'raw', line: testCase }).handle()).not.toThrow();
        }
      });

      it('should not crash on strings with IRC special characters', () => {
        setupMocks();

        const ircSpecialCases = [
          ':',
          '::',
          ':::',
          '@',
          '@@',
          '@@@',
          ':@:@:',
          '@ :',
          ': @',
          '\x01',
          '\x01ACTION\x01',
          '\x02\x03\x0F\x16\x1D\x1F',
          ':nick!user@host',
          '@tag=value :nick!user@host COMMAND',
        ];
        for (const testCase of ircSpecialCases) {
          expect(() => new Kernel({ type: 'raw', line: testCase }).handle()).not.toThrow();
        }
      });
    });

    describe('PRIVMSG fuzzing', () => {
      it('should not crash on fuzzed PRIVMSG messages', () => {
        setupMocks();

        handlesAll(fc.tuple(msgid, hostmask, channel, text(200)).map(([tag, sender, target, words]) => `${tag}:${sender} PRIVMSG ${target} :${words}`));
      });

      it('should not crash on PRIVMSG with malformed targets', () => {
        setupMocks();

        const malformedTargets = ['', ' ', '#', '&', '+', '!', '##', '&&', filler(500)];
        for (const target of malformedTargets) {
          const line = `@msgid=test;time=2023-01-01T00:00:00.000Z :user!~user@host PRIVMSG ${target} :message`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on PRIVMSG with CTCP variations', () => {
        setupMocks();

        const ctcpVariations = [
          '\x01',
          '\x01\x01',
          '\x01ACTION\x01',
          '\x01VERSION\x01',
          '\x01PING ' + filler(20) + '\x01',
          '\x01' + filler(50) + '\x01',
          '\x01ACTION ' + filler(100) + '\x01',
        ];
        for (const ctcp of ctcpVariations) {
          const line = `@msgid=test;time=2023-01-01T00:00:00.000Z :user!~user@host PRIVMSG #channel :${ctcp}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('CTCP PING sanitization', () => {
      it('should reflect normal CTCP PING payload', () => {
        setupMocks();
        const mockSend = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :user!~user@host PRIVMSG testuser :\x01PING 1234567890\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSend).toHaveBeenCalledWith('NOTICE user :\x01PING 1234567890\x01');
      });

      it('should strip control characters from CTCP PING payload', () => {
        setupMocks();
        const mockSend = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :user!~user@host PRIVMSG testuser :\x01PING abc\r\ndef\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSend).toHaveBeenCalledWith('NOTICE user :\x01PING abcdef\x01');
      });

      it('should truncate long CTCP PING payload to 32 characters', () => {
        setupMocks();
        const mockSend = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

        const longPayload = 'A'.repeat(100);
        const line = `@msgid=test;time=2023-01-01T00:00:00.000Z :user!~user@host PRIVMSG testuser :\x01PING ${longPayload}\x01`;
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSend).toHaveBeenCalledWith(`NOTICE user :\x01PING ${'A'.repeat(32)}\x01`);
      });
    });

    describe('CTCP request notifications', () => {
      it('should show request and response notifications for CTCP VERSION', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host PRIVMSG testuser :\x01VERSION\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpRequest', { nick: 'sender', command: 'VERSION' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpResponse', { nick: 'sender', command: 'VERSION', response: clientVersion }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
      });

      it('should show request and response notifications for CTCP TIME', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host PRIVMSG testuser :\x01TIME\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpRequest', { nick: 'sender', command: 'TIME' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining('CTCP TIME'),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
      });

      it('should show request and response notifications for CTCP PING', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host PRIVMSG testuser :\x01PING 12345\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpRequest', { nick: 'sender', command: 'PING' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpResponse', { nick: 'sender', command: 'PING', response: '12345' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
      });

      it('should show request and response notifications for CTCP CLIENTINFO', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host PRIVMSG testuser :\x01CLIENTINFO\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpRequest', { nick: 'sender', command: 'CLIENTINFO' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpResponse', { nick: 'sender', command: 'CLIENTINFO', response: 'ACTION VERSION TIME PING USERINFO SOURCE CLIENTINFO SIC-E2EE' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
      });

      it('should not show notification for CTCP ACTION', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host PRIVMSG #test :\x01ACTION waves\x01';
        new Kernel({ type: 'raw', line }).handle();

        const ctcpNotificationCalls = mockSetAddMessage.mock.calls.filter(
          ([arg]) => arg.message?.includes?.('CTCP')
        );
        expect(ctcpNotificationCalls).toHaveLength(0);
      });

      it('should not show notification for unknown CTCP commands', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host PRIVMSG testuser :\x01UNKNOWNCMD\x01';
        new Kernel({ type: 'raw', line }).handle();

        const ctcpNotificationCalls = mockSetAddMessage.mock.calls.filter(
          ([arg]) => arg.category === 'notice'
        );
        expect(ctcpNotificationCalls).toHaveLength(0);
      });
    });

    describe('CTCP reply in NOTICE', () => {
      it('should show formatted CTCP VERSION reply', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host NOTICE testuser :\x01VERSION Simple IRC Client\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpReply', { nick: 'sender', command: 'VERSION', response: 'Simple IRC Client' }),
          target: STATUS_CHANNEL,
          category: 'notice',
          color: 'var(--msg-notice)',
        }));
      });

      it('should show formatted CTCP PING reply', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host NOTICE testuser :\x01PING 1234567890\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpReply', { nick: 'sender', command: 'PING', response: '1234567890' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
      });

      it('should show formatted CTCP TIME reply', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host NOTICE testuser :\x01TIME Mon Jan 01 2023\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpReply', { nick: 'sender', command: 'TIME', response: 'Mon Jan 01 2023' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
      });

      it('should handle CTCP reply with no response parameter', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host NOTICE testuser :\x01VERSION\x01';
        new Kernel({ type: 'raw', line }).handle();

        expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: i18next.t('kernel.ctcpReply', { nick: 'sender', command: 'VERSION', response: '' }),
          target: STATUS_CHANNEL,
          category: 'notice',
        }));
      });

      it('should ignore CTCP reply not addressed to us', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host NOTICE Global :\x01VERSION Simple IRC Client\x01';
        new Kernel({ type: 'raw', line }).handle();

        const ctcpCalls = mockSetAddMessage.mock.calls.filter(
          ([arg]) => arg.message?.includes?.('CTCP')
        );
        expect(ctcpCalls).toHaveLength(0);
      });

      it('should not treat regular NOTICE as CTCP reply', () => {
        setupMocks();
        const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

        const line = '@msgid=test;time=2023-01-01T00:00:00.000Z :sender!~user@host NOTICE testuser :This is a regular notice';
        new Kernel({ type: 'raw', line }).handle();

        const calls = mockSetAddMessage.mock.calls.filter(
          ([arg]) => arg.message?.includes?.('CTCP')
        );
        expect(calls).toHaveLength(0);
      });
    });

    describe('MODE fuzzing', () => {
      it('should not crash on fuzzed channel MODE messages', () => {
        setupMocks();

        const mode = fc.constantFrom('+', '-', '+o', '-o', '+v', '-v', '+b', '-b', '+k', '-k', '+l', '-l', '+i', '-i', '+m', '-m', '+n', '-n', '+s', '-s', '+t', '-t');
        const args = fc.option(nick, { nil: undefined }).map((target) => (target === undefined ? '' : ` ${target}`));
        handlesAll(fc.tuple(hostmask, channel, mode, args).map(([sender, target, change, arg]) => `:${sender} MODE ${target} ${change}${arg}`));
      });

      it('should not crash on MODE with complex mode strings', () => {
        setupMocks();

        const complexModes = [
          '+ooo nick1 nick2 nick3',
          '-vvv nick1 nick2 nick3',
          '+ov-b nick1 nick2 *!*@*.host',
          '+kb key *!*@host',
          '+l 100',
          '-l',
          '+' + 'o'.repeat(20) + ' ' + new Array(20).fill('nick').join(' '),
          '-' + filler(50),
          '+' + filler(50) + ' ' + filler(50),
        ];
        for (const modes of complexModes) {
          const line = `:server MODE #channel ${modes}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on user MODE messages', () => {
        setupMocks();

        const userModes = ['+i', '-i', '+w', '-w', '+o', '-o', '+x', '-x', '+' + filler(10), '-' + filler(10)];
        for (const mode of userModes) {
          const line = `:nick MODE nick ${mode}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('JOIN fuzzing', () => {
      it('should not crash on fuzzed JOIN messages', () => {
        setupMocks();

        handlesAll(fc.tuple(tags, hostmask, channel).map(([tag, sender, target]) => `${tag}:${sender} JOIN ${target}`));
      });

      it('should not crash on JOIN with extended-join data', () => {
        setupMocks();

        const extendedJoins = [
          ':nick!user@host JOIN #channel account :Real Name',
          ':nick!user@host JOIN #channel * :Real Name',
          ':nick!user@host JOIN #channel account123 :' + filler(100),
          ':nick!user@host JOIN #channel ' + filler(20) + ' :' + filler(50),
        ];
        for (const line of extendedJoins) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on JOIN with malformed channel names', () => {
        setupMocks();

        const malformedChannels = ['', '#', '##', '#' + filler(300), '# ', '#\x00', '#\x07'];
        for (const channel of malformedChannels) {
          const line = `:nick!user@host JOIN ${channel}`;
          // Kernel logs errors to Sentry and returns gracefully instead of throwing
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('PART fuzzing', () => {
      it('should not crash on fuzzed PART messages', () => {
        setupMocks();

        handlesAll(fc.tuple(tags, hostmask, channel, reason).map(([tag, sender, target, why]) => `${tag}:${sender} PART ${target}${why}`));
      });

      it('should not crash on PART with various reason formats', () => {
        setupMocks();

        const reasons = ['', ' ', ' :', ' :reason', ' :' + filler(500), ' :::', ' :\x01ACTION leaves\x01'];
        for (const reason of reasons) {
          const line = `:nick!user@host PART #channel${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('KICK fuzzing', () => {
      it('should not crash on fuzzed KICK messages', () => {
        setupMocks();

        handlesAll(fc.tuple(hostmask, channel, nick, reason).map(([sender, target, kicked, why]) => `:${sender} KICK ${target} ${kicked}${why}`));
      });

      it('should not crash on KICK with malformed parameters', () => {
        setupMocks();

        const malformedKicks = [
          ':nick!user@host KICK #channel',
          ':nick!user@host KICK #channel ',
          ':nick!user@host KICK  targetNick',
          ':nick!user@host KICK #channel targetNick :' + filler(1000),
        ];
        for (const line of malformedKicks) {
          // Kernel logs errors to Sentry and returns gracefully instead of throwing
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('QUIT fuzzing', () => {
      it('should not crash on fuzzed QUIT messages', () => {
        setupMocks();

        handlesAll(fc.tuple(tags, hostmask, reason).map(([tag, sender, why]) => `${tag}:${sender} QUIT${why}`));
      });
    });

    describe('NICK fuzzing', () => {
      it('should not crash on fuzzed NICK messages', () => {
        setupMocks();

        handlesAll(fc.tuple(tags, hostmask, text(30, 1)).map(([tag, sender, newNick]) => `${tag}:${sender} NICK :${newNick}`));
      });

      it('should not crash on NICK with special characters', () => {
        setupMocks();

        const specialNicks = ['', ' ', '123', '[nick]', '{nick}', 'nick|away', 'nick_', 'nick-', filler(100)];
        for (const nick of specialNicks) {
          const line = `:oldnick!user@host NICK :${nick}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('TOPIC fuzzing', () => {
      it('should not crash on fuzzed TOPIC messages', () => {
        setupMocks();

        handlesAll(fc.tuple(tags, hostmask, channel, text(300)).map(([tag, sender, target, topic]) => `${tag}:${sender} TOPIC ${target} :${topic}`));
      });

      it('should not crash on TOPIC with special content', () => {
        setupMocks();

        const specialTopics = ['', ' ', '\x02bold\x02', '\x0304,01colored\x03', '\x1Funderline\x1F', '🔥🎉💻', filler(1000)];
        for (const topic of specialTopics) {
          const line = `:nick!user@host TOPIC #channel :${topic}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('NOTICE fuzzing', () => {
      it('should not crash on fuzzed NOTICE messages', () => {
        setupMocks();

        handlesAll(fc.tuple(msgid, hostmask, fc.oneof(channel, nick), text(200)).map(([tag, sender, target, words]) => `${tag}:${sender} NOTICE ${target} :${words}`));
      });
    });

    describe('numeric reply fuzzing', () => {
      it('should not crash on fuzzed RPL_WELCOME (001)', () => {
        setupMocks();

        handlesAll(fc.tuple(nick, text(20), hostmask).map(([me, network, mask]) => `:server 001 ${me} :Welcome to the ${network} Network ${mask}`), 20);
      });

      it('should not crash on fuzzed RPL_ISUPPORT (005)', () => {
        setupMocks();

        const isupportToken = fc.oneof(
          fc.constantFrom('CHANTYPES=#&', 'CHANMODES=beI,k,l,imnpst', 'PREFIX=(qaohv)~&@%+', 'CASEMAPPING=rfc1459'),
          text(20).map((network) => `NETWORK=${network}`),
          fc.tuple(fc.constantFrom('NICKLEN', 'MODES', 'TOPICLEN'), fc.nat(1000)).map(([key, value]) => `${key}=${value}`),
          fc.tuple(text(20), text(30)).map(([key, value]) => `${key}=${value}`),
        );
        handlesAll(fc.array(isupportToken, { minLength: 1, maxLength: 10 }).map((tokens) => `:server 005 nick ${tokens.join(' ')} :are supported by this server`), 20);
      });

      it('should not crash on fuzzed RPL_NAMREPLY (353)', () => {
        setupMocks();

        handlesAll(fc.tuple(channel, fc.array(nick, { minLength: 1, maxLength: 50 })).map(([target, nicks]) => `:server 353 mynick = ${target} :${nicks.join(' ')}`), 20);
      });

      it('should not crash on fuzzed RPL_TOPIC (332)', () => {
        setupMocks();

        handlesAll(fc.tuple(channel, text(300)).map(([target, topic]) => `:server 332 nick ${target} :${topic}`), 20);
      });

      it('should not crash on fuzzed RPL_WHOREPLY (352)', () => {
        setupMocks();

        const flags = fc.constantFrom('H', 'G', 'H*', 'G*', 'H@', 'G@', 'H+', 'G+');
        handlesAll(fc.tuple(channel, text(10), text(20), nick, flags, text(30)).map(([target, ident, host, who, flag, realname]) => `:server 352 mynick ${target} ~${ident} ${host} server ${who} ${flag} :0 ${realname}`), 20);
      });

      it('should not crash on fuzzed error numerics', () => {
        setupMocks();

        const errorNumerics = [
          '401', // ERR_NOSUCHNICK
          '403', // ERR_NOSUCHCHANNEL
          '404', // ERR_CANNOTSENDTOCHAN
          '421', // ERR_UNKNOWNCOMMAND
          '432', // ERR_ERRONEUSNICKNAME
          '433', // ERR_NICKNAMEINUSE
          '461', // ERR_NEEDMOREPARAMS
          '473', // ERR_INVITEONLYCHAN
          '474', // ERR_BANNEDFROMCHAN
          '475', // ERR_BADCHANNELKEY
          '482', // ERR_CHANOPRIVSNEEDED
        ];
        handlesAll(fc.tuple(fc.constantFrom(...errorNumerics), text(20), text(50)).map(([numeric, target, words]) => `:server ${numeric} nick ${target} :${words}`));
      });

      it('should not crash on random numeric values', () => {
        setupMocks();

        handlesAll(fc.tuple(fc.nat(999), text(30), text(100)).map(([numeric, target, words]) => `:server ${String(numeric).padStart(3, '0')} nick ${target} :${words}`), 100);
      });
    });

    describe('WHOIS reply fuzzing', () => {
      it('should not crash on fuzzed WHOIS replies', () => {
        setupMocks();

        const whoisReplies = (who: string, word: string, words: string, channels: string[], idle: number): string[] => [
          `:server 311 me ${who} ~${word} ${words} * :${words}`,
          `:server 312 me ${who} server.name :${words}`,
          `:server 313 me ${who} :is an IRC Operator`,
          `:server 317 me ${who} ${idle} 1700000000 :seconds idle, signon time`,
          `:server 318 me ${who} :End of /WHOIS list`,
          `:server 319 me ${who} :${channels.join(' ')}`,
          `:server 330 me ${who} ${word} :is logged in as`,
          `:server 338 me ${who} ${word} :actually using host`,
          `:server 378 me ${who} :is connecting from *@${words}`,
          `:server 671 me ${who} :is using a secure connection`,
        ];

        fc.assert(fc.property(nick, text(15), text(50), fc.array(channel, { maxLength: 5 }), fc.nat(100_000), (who, word, words, channels, idle) => {
          for (const line of whoisReplies(who, word, words, channels, idle)) {
            handles(line);
          }
        }), { numRuns: 30 });
      });
    });

    describe('CAP fuzzing', () => {
      it('should not crash on fuzzed CAP messages', () => {
        setupMocks();

        const capSubcommands = ['LS', 'LIST', 'REQ', 'ACK', 'NAK', 'NEW', 'DEL', 'END'];
        const capability = fc.oneof(fc.constantFrom('multi-prefix', 'away-notify', 'account-notify', 'extended-join', 'sasl', 'message-tags', 'batch', 'server-time'), text(20));

        handlesAll(fc.tuple(fc.constantFrom(...capSubcommands), fc.array(capability, { minLength: 1, maxLength: 10 })).map(([subcommand, caps]) => `:server CAP * ${subcommand} :${caps.join(' ')}`), 30);
      });

      it('should not crash on CAP with multiline indicator', () => {
        setupMocks();

        const lines = [':server CAP * LS * :cap1 cap2 cap3', ':server CAP * LS :cap4 cap5', ':server CAP nick LS * :' + filler(200), ':server CAP nick LS :' + filler(200)];
        for (const line of lines) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('BATCH fuzzing', () => {
      it('should not crash on fuzzed BATCH messages', () => {
        setupMocks();

        const batchType = fc.oneof(fc.constantFrom('chathistory', 'netjoin', 'netsplit'), text(15));

        fc.assert(fc.property(text(20), batchType, channel, (batchId, type, target) => {
          handles(`:server BATCH +${batchId} ${type} ${target}`);
          handles(`:server BATCH -${batchId}`);
        }), { numRuns: 20 });
      });
    });

    describe('PING/PONG fuzzing', () => {
      it('should not crash on fuzzed PING messages', () => {
        setupMocks();

        handlesAll(text(100).map((data) => `PING :${data}`), 20);
      });

      it('should not crash on PING with various formats', () => {
        setupMocks();

        const pingFormats = ['PING :server', 'PING server', 'PING :' + filler(500), 'PING', 'PING :', 'PING ::', ':server PING :client'];
        for (const line of pingFormats) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('ERROR fuzzing', () => {
      it('should not crash on fuzzed ERROR messages', () => {
        setupMocks();

        const errorMessages = [
          'ERROR :Closing Link: ' + filler(30),
          'ERROR :' + filler(200),
          'ERROR',
          'ERROR :',
          'ERROR ::',
          'ERROR :Banned',
          'ERROR :Connection timed out',
          'ERROR :Too many connections from your IP',
        ];
        for (const line of errorMessages) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('tag fuzzing', () => {
      it('should not crash on messages with malformed tags', () => {
        setupMocks();

        const malformedTags = [
          '@',
          '@ ',
          '@=',
          '@key',
          '@key=',
          '@=value',
          '@key=value=extra',
          '@;',
          '@;;',
          '@key=value;',
          '@;key=value',
          '@key=value;;key2=value2',
          '@' + filler(1000),
          '@' + 'key=value;'.repeat(100),
        ];

        for (const tag of malformedTags) {
          const line = `${tag} :nick!user@host PRIVMSG #channel :message`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on tags with special values', () => {
        setupMocks();

        const specialTagValues = [
          '@time=invalid-time',
          '@time=2023-13-45T99:99:99.999Z',
          '@msgid=' + filler(1000),
          '@account=',
          '@account=*',
          '@' + filler(50) + '=' + filler(100),
        ];

        for (const tag of specialTagValues) {
          const line = `${tag} :nick!user@host PRIVMSG #channel :message`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('sender fuzzing', () => {
      it('should not crash on malformed senders', () => {
        setupMocks();

        const malformedSenders = [
          ':',
          '::',
          ':nick',
          ':nick!',
          ':nick@',
          ':nick!user',
          ':nick!user@',
          ':!user@host',
          ':nick!@host',
          ':@host',
          ':' + filler(500) + '!' + filler(100) + '@' + filler(200),
          ':\x00\x01\x02',
        ];

        for (const sender of malformedSenders) {
          const line = `${sender} PRIVMSG #channel :message`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('LIST fuzzing', () => {
      it('should not crash on fuzzed LIST replies (322)', () => {
        setupMocks();

        handlesAll(fc.tuple(channel, fc.nat(10_000), text(300)).map(([target, users, topic]) => `:server 322 nick ${target} ${users} :${topic}`), 20);
      });

      it('should not crash on fuzzed ENDOFLIST (323)', () => {
        setupMocks();

        const lines = [':server 323 nick :End of /LIST', ':server 323 nick :' + filler(100), ':server 323 some-nick :End of LIST'];
        for (const line of lines) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('INVITE fuzzing', () => {
      it('should not crash on fuzzed INVITE messages', () => {
        setupMocks();

        handlesAll(fc.tuple(msgid, hostmask, nick, channel).map(([tag, sender, invited, target]) => `${tag}:${sender} INVITE ${invited} ${target}`), 20);
      });
    });

    describe('ban list fuzzing', () => {
      it('should not crash on fuzzed ban list replies (367)', () => {
        setupMocks();

        handlesAll(fc.tuple(channel, text(30), hostmask).map(([target, host, setter]) => `:server 367 nick ${target} *!*@${host} ${setter} 1700000000`), 20);
      });

      it('should not crash on malformed ban masks', () => {
        setupMocks();

        const malformedMasks = ['*', '*!*', '*!*@*', '', filler(500), '!@', '*!*@', '@*'];
        for (const mask of malformedMasks) {
          const line = `:server 367 nick #channel ${mask} setter 1234567890`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });
  });
});
