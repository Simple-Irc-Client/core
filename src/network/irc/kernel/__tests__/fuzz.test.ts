/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
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
    // Helper functions for generating random data
    const randomString = (length: number): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const randomNick = (): string => {
      const prefixes = ['', '~', '&', '@', '%', '+'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return prefix + randomString(Math.floor(Math.random() * 15) + 1);
    };

    const randomChannel = (): string => {
      const prefixes = ['#', '&', '+', '!'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return prefix + randomString(Math.floor(Math.random() * 20) + 1);
    };

    const randomHostmask = (): string => {
      const nick = randomString(Math.floor(Math.random() * 15) + 1);
      const ident = randomString(Math.floor(Math.random() * 10) + 1);
      const host = randomString(Math.floor(Math.random() * 30) + 1);
      return `${nick}!~${ident}@${host}`;
    };

    const randomTags = (): string => {
      const tags: string[] = [];
      const tagCount = Math.floor(Math.random() * 5);
      for (let i = 0; i < tagCount; i++) {
        const key = randomString(Math.floor(Math.random() * 10) + 1);
        const value = randomString(Math.floor(Math.random() * 20));
        tags.push(`${key}=${value}`);
      }
      return tags.length > 0 ? '@' + tags.join(';') + ' ' : '';
    };

    const randomMsgid = (): string => {
      return `@msgid=${randomString(22)};time=${new Date().toISOString()} `;
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

        for (let i = 0; i < 100; i++) {
          const randomLine = randomString(Math.floor(Math.random() * 500) + 1);
          expect(() => new Kernel({ type: 'raw', line: randomLine }).handle()).not.toThrow();
        }
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

        const longStrings = [randomString(1000), randomString(5000), randomString(10000), 'A'.repeat(50000)];
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

        for (let i = 0; i < 50; i++) {
          const line = `${randomMsgid()}:${randomHostmask()} PRIVMSG ${randomChannel()} :${randomString(Math.floor(Math.random() * 200))}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on PRIVMSG with malformed targets', () => {
        setupMocks();

        const malformedTargets = ['', ' ', '#', '&', '+', '!', '##', '&&', randomString(500)];
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
          '\x01PING ' + randomString(20) + '\x01',
          '\x01' + randomString(50) + '\x01',
          '\x01ACTION ' + randomString(100) + '\x01',
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

        for (let i = 0; i < 50; i++) {
          const modes = ['+', '-', '+o', '-o', '+v', '-v', '+b', '-b', '+k', '-k', '+l', '-l', '+i', '-i', '+m', '-m', '+n', '-n', '+s', '-s', '+t', '-t'];
          const mode = modes[Math.floor(Math.random() * modes.length)];
          const args = Math.random() > 0.5 ? ' ' + randomNick() : '';
          const line = `:${randomHostmask()} MODE ${randomChannel()} ${mode}${args}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
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
          '-' + randomString(50),
          '+' + randomString(50) + ' ' + randomString(50),
        ];
        for (const modes of complexModes) {
          const line = `:server MODE #channel ${modes}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on user MODE messages', () => {
        setupMocks();

        const userModes = ['+i', '-i', '+w', '-w', '+o', '-o', '+x', '-x', '+' + randomString(10), '-' + randomString(10)];
        for (const mode of userModes) {
          const line = `:nick MODE nick ${mode}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('JOIN fuzzing', () => {
      it('should not crash on fuzzed JOIN messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const channel = randomChannel();
          const line = `${randomTags()}:${randomHostmask()} JOIN ${channel}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on JOIN with extended-join data', () => {
        setupMocks();

        const extendedJoins = [
          ':nick!user@host JOIN #channel account :Real Name',
          ':nick!user@host JOIN #channel * :Real Name',
          ':nick!user@host JOIN #channel account123 :' + randomString(100),
          ':nick!user@host JOIN #channel ' + randomString(20) + ' :' + randomString(50),
        ];
        for (const line of extendedJoins) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on JOIN with malformed channel names', () => {
        setupMocks();

        const malformedChannels = ['', '#', '##', '#' + randomString(300), '# ', '#\x00', '#\x07'];
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

        for (let i = 0; i < 50; i++) {
          const hasReason = Math.random() > 0.5;
          const reason = hasReason ? ' :' + randomString(Math.floor(Math.random() * 100)) : '';
          const line = `${randomTags()}:${randomHostmask()} PART ${randomChannel()}${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on PART with various reason formats', () => {
        setupMocks();

        const reasons = ['', ' ', ' :', ' :reason', ' :' + randomString(500), ' :::', ' :\x01ACTION leaves\x01'];
        for (const reason of reasons) {
          const line = `:nick!user@host PART #channel${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('KICK fuzzing', () => {
      it('should not crash on fuzzed KICK messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const hasReason = Math.random() > 0.5;
          const reason = hasReason ? ' :' + randomString(Math.floor(Math.random() * 100)) : '';
          const line = `:${randomHostmask()} KICK ${randomChannel()} ${randomNick()}${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on KICK with malformed parameters', () => {
        setupMocks();

        const malformedKicks = [
          ':nick!user@host KICK #channel',
          ':nick!user@host KICK #channel ',
          ':nick!user@host KICK  targetNick',
          ':nick!user@host KICK #channel targetNick :' + randomString(1000),
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

        for (let i = 0; i < 50; i++) {
          const hasReason = Math.random() > 0.5;
          const reason = hasReason ? ' :' + randomString(Math.floor(Math.random() * 100)) : '';
          const line = `${randomTags()}:${randomHostmask()} QUIT${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('NICK fuzzing', () => {
      it('should not crash on fuzzed NICK messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const newNick = randomString(Math.floor(Math.random() * 30) + 1);
          const line = `${randomTags()}:${randomHostmask()} NICK :${newNick}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on NICK with special characters', () => {
        setupMocks();

        const specialNicks = ['', ' ', '123', '[nick]', '{nick}', 'nick|away', 'nick_', 'nick-', randomString(100)];
        for (const nick of specialNicks) {
          const line = `:oldnick!user@host NICK :${nick}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('TOPIC fuzzing', () => {
      it('should not crash on fuzzed TOPIC messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const topic = randomString(Math.floor(Math.random() * 300));
          const line = `${randomTags()}:${randomHostmask()} TOPIC ${randomChannel()} :${topic}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on TOPIC with special content', () => {
        setupMocks();

        const specialTopics = ['', ' ', '\x02bold\x02', '\x0304,01colored\x03', '\x1Funderline\x1F', '🔥🎉💻', randomString(1000)];
        for (const topic of specialTopics) {
          const line = `:nick!user@host TOPIC #channel :${topic}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('NOTICE fuzzing', () => {
      it('should not crash on fuzzed NOTICE messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const target = Math.random() > 0.5 ? randomChannel() : randomNick();
          const message = randomString(Math.floor(Math.random() * 200));
          const line = `${randomMsgid()}:${randomHostmask()} NOTICE ${target} :${message}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('numeric reply fuzzing', () => {
      it('should not crash on fuzzed RPL_WELCOME (001)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const line = `:server 001 ${randomNick()} :Welcome to the ${randomString(20)} Network ${randomHostmask()}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed RPL_ISUPPORT (005)', () => {
        setupMocks();

        const isupportTokens = [
          'CHANTYPES=#&',
          'CHANMODES=beI,k,l,imnpst',
          'PREFIX=(qaohv)~&@%+',
          'NETWORK=' + randomString(20),
          'CASEMAPPING=rfc1459',
          'NICKLEN=' + Math.floor(Math.random() * 50),
          'MODES=' + Math.floor(Math.random() * 20),
          'TOPICLEN=' + Math.floor(Math.random() * 1000),
          randomString(20) + '=' + randomString(30),
        ];
        for (let i = 0; i < 20; i++) {
          const tokens = new Array(Math.floor(Math.random() * 10) + 1)
            .fill(0)
            .map(() => isupportTokens[Math.floor(Math.random() * isupportTokens.length)]);
          const line = `:server 005 nick ${tokens.join(' ')} :are supported by this server`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed RPL_NAMREPLY (353)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const nicks = new Array(Math.floor(Math.random() * 50) + 1)
            .fill(0)
            .map(() => randomNick());
          const line = `:server 353 mynick = ${randomChannel()} :${nicks.join(' ')}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed RPL_TOPIC (332)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const line = `:server 332 nick ${randomChannel()} :${randomString(Math.floor(Math.random() * 300))}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed RPL_WHOREPLY (352)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const flags = ['H', 'G', 'H*', 'G*', 'H@', 'G@', 'H+', 'G+'][Math.floor(Math.random() * 8)];
          const line = `:server 352 mynick ${randomChannel()} ~${randomString(10)} ${randomString(20)} server ${randomNick()} ${flags} :0 ${randomString(30)}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
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
        for (const numeric of errorNumerics) {
          for (let i = 0; i < 5; i++) {
            const line = `:server ${numeric} nick ${randomString(20)} :${randomString(50)}`;
            expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
          }
        }
      });

      it('should not crash on random numeric values', () => {
        setupMocks();

        for (let i = 0; i < 100; i++) {
          const numeric = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
          const line = `:server ${numeric} nick ${randomString(30)} :${randomString(100)}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('WHOIS reply fuzzing', () => {
      it('should not crash on fuzzed WHOIS replies', () => {
        setupMocks();

        const whoisNumerics = [
          { num: '311', format: (n: string) => `:server 311 me ${n} ~${randomString(10)} ${randomString(30)} * :${randomString(50)}` },
          { num: '312', format: (n: string) => `:server 312 me ${n} server.name :${randomString(30)}` },
          { num: '313', format: (n: string) => `:server 313 me ${n} :is an IRC Operator` },
          { num: '317', format: (n: string) => `:server 317 me ${n} ${Math.floor(Math.random() * 100000)} ${Math.floor(Date.now() / 1000)} :seconds idle, signon time` },
          { num: '318', format: (n: string) => `:server 318 me ${n} :End of /WHOIS list` },
          { num: '319', format: (n: string) => `:server 319 me ${n} :${new Array(5).fill(0).map(() => randomChannel()).join(' ')}` },
          { num: '330', format: (n: string) => `:server 330 me ${n} ${randomString(15)} :is logged in as` },
          { num: '338', format: (n: string) => `:server 338 me ${n} ${randomString(15)} :actually using host` },
          { num: '378', format: (n: string) => `:server 378 me ${n} :is connecting from *@${randomString(30)}` },
          { num: '671', format: (n: string) => `:server 671 me ${n} :is using a secure connection` },
        ];

        for (let i = 0; i < 30; i++) {
          const nick = randomNick();
          for (const reply of whoisNumerics) {
            expect(() => new Kernel({ type: 'raw', line: reply.format(nick) }).handle()).not.toThrow();
          }
        }
      });
    });

    describe('CAP fuzzing', () => {
      it('should not crash on fuzzed CAP messages', () => {
        setupMocks();

        const capSubcommands = ['LS', 'LIST', 'REQ', 'ACK', 'NAK', 'NEW', 'DEL', 'END'];
        const capabilities = ['multi-prefix', 'away-notify', 'account-notify', 'extended-join', 'sasl', 'message-tags', 'batch', 'server-time', randomString(20)];

        for (let i = 0; i < 30; i++) {
          const subcommand = capSubcommands[Math.floor(Math.random() * capSubcommands.length)];
          const caps = new Array(Math.floor(Math.random() * 10) + 1)
            .fill(0)
            .map(() => capabilities[Math.floor(Math.random() * capabilities.length)]);
          const line = `:server CAP * ${subcommand} :${caps.join(' ')}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on CAP with multiline indicator', () => {
        setupMocks();

        const lines = [':server CAP * LS * :cap1 cap2 cap3', ':server CAP * LS :cap4 cap5', ':server CAP nick LS * :' + randomString(200), ':server CAP nick LS :' + randomString(200)];
        for (const line of lines) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('BATCH fuzzing', () => {
      it('should not crash on fuzzed BATCH messages', () => {
        setupMocks();

        const batchTypes = ['chathistory', 'netjoin', 'netsplit', randomString(15)];

        for (let i = 0; i < 20; i++) {
          const batchId = randomString(20);
          const batchType = batchTypes[Math.floor(Math.random() * batchTypes.length)];
          const startLine = `:server BATCH +${batchId} ${batchType} ${randomChannel()}`;
          const endLine = `:server BATCH -${batchId}`;

          expect(() => new Kernel({ type: 'raw', line: startLine }).handle()).not.toThrow();
          expect(() => new Kernel({ type: 'raw', line: endLine }).handle()).not.toThrow();
        }
      });
    });

    describe('PING/PONG fuzzing', () => {
      it('should not crash on fuzzed PING messages', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const pingData = randomString(Math.floor(Math.random() * 100));
          const line = `PING :${pingData}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on PING with various formats', () => {
        setupMocks();

        const pingFormats = ['PING :server', 'PING server', 'PING :' + randomString(500), 'PING', 'PING :', 'PING ::', ':server PING :client'];
        for (const line of pingFormats) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('ERROR fuzzing', () => {
      it('should not crash on fuzzed ERROR messages', () => {
        setupMocks();

        const errorMessages = [
          'ERROR :Closing Link: ' + randomString(30),
          'ERROR :' + randomString(200),
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
          '@' + randomString(1000),
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
          '@msgid=' + randomString(1000),
          '@account=',
          '@account=*',
          '@' + randomString(50) + '=' + randomString(100),
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
          ':' + randomString(500) + '!' + randomString(100) + '@' + randomString(200),
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

        for (let i = 0; i < 20; i++) {
          const userCount = Math.floor(Math.random() * 10000);
          const topic = randomString(Math.floor(Math.random() * 300));
          const line = `:server 322 nick ${randomChannel()} ${userCount} :${topic}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed ENDOFLIST (323)', () => {
        setupMocks();

        const lines = [':server 323 nick :End of /LIST', ':server 323 nick :' + randomString(100), ':server 323 ' + randomNick() + ' :End of LIST'];
        for (const line of lines) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('INVITE fuzzing', () => {
      it('should not crash on fuzzed INVITE messages', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const line = `${randomMsgid()}:${randomHostmask()} INVITE ${randomNick()} ${randomChannel()}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('ban list fuzzing', () => {
      it('should not crash on fuzzed ban list replies (367)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const banMask = '*!*@' + randomString(30);
          const setter = randomHostmask();
          const timestamp = Math.floor(Date.now() / 1000);
          const line = `:server 367 nick ${randomChannel()} ${banMask} ${setter} ${timestamp}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on malformed ban masks', () => {
        setupMocks();

        const malformedMasks = ['*', '*!*', '*!*@*', '', randomString(500), '!@', '*!*@', '@*'];
        for (const mask of malformedMasks) {
          const line = `:server 367 nick #channel ${mask} setter 1234567890`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });
  });
});
