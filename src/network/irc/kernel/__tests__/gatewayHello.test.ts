/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as networksStore from '@features/networks/store/networks';
import * as channelsFile from '@features/channels/store/channels';
import * as friendsFile from '@features/friends/friends';
import * as networkFile from '@/network/irc/network';
import * as e2eeSessionFile from '@features/e2ee/session';
import {
  beginGatewayConnection,
  forgetGatewaySession,
  hasGatewaySession,
  rememberGatewaySession,
} from '@/network/irc/gatewaySession';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';
import i18next from '@/app/i18n';

const raw = (line: string): void => new Kernel({ type: 'raw', line }).handle();

const target = { host: 'irc.test', port: 6697, tls: true, encoding: 'utf8' };

describe('kernel gateway hello', () => {
  setupKernelTest();

  let send: MockInstance<typeof networkFile.ircSendRawMessage>;

  beforeEach(() => {
    forgetGatewaySession();
    vi.spyOn(networksStore, 'getCurrentNick').mockImplementation(() => 'TestNick');
    vi.spyOn(networksStore, 'getServer').mockImplementation(() => undefined);
    vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    vi.spyOn(networkFile, 'resetConnectionState').mockImplementation(() => {});
    send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
  });

  const sentLines = (): string[] => send.mock.calls.map(([line]) => line);

  const resumeAttempt = (): void => {
    beginGatewayConnection(false, target);
    rememberGatewaySession('token-1');
    beginGatewayConnection(true, target);
    new Kernel({ type: 'connect' }).handle();
  };

  it('remembers the token of a new session', () => {
    beginGatewayConnection(false, target);
    new Kernel({ type: 'connect' }).handle();
    raw(':sic-gateway SESSION abc_DEF-123');

    expect(hasGatewaySession()).toBe(true);
    expect(beginGatewayConnection(true, target).query).toEqual({ resume: 'abc_DEF-123', since: '0' });
  });

  it('does not register while waiting to hear whether the session was resumed', () => {
    resumeAttempt();

    expect(sentLines()).toEqual([]);
  });

  it('marks the resumed session connected without registering or rejoining', () => {
    const setIsConnected = vi.spyOn(networksStore, 'setIsConnected').mockImplementation(() => {});
    const joinChannels = vi.spyOn(networkFile, 'ircJoinChannels').mockImplementation(() => {});
    const subscribeFriends = vi.spyOn(friendsFile, 'subscribeFriendsOnRegistration').mockImplementation(() => {});
    resumeAttempt();

    raw(':sic-gateway RESUMED complete');

    expect(setIsConnected).toHaveBeenCalledWith(true);
    expect(networkFile.startKeepalive).toHaveBeenCalled();
    expect(subscribeFriends).toHaveBeenCalled();
    expect(joinChannels).not.toHaveBeenCalled();
    expect(sentLines().some((line) => /^(CAP|NICK|USER|NAMES|LIST)\b/.test(line))).toBe(false);
    expect(channelsFile.setAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.resumed') }));
  });

  it('keeps encrypted conversations over a dropped WebSocket the gateway may resume', () => {
    const endSessions = vi.spyOn(e2eeSessionFile, 'endAllSessions').mockImplementation(() => {});
    beginGatewayConnection(false, target);
    new Kernel({ type: 'connect' }).handle();
    raw(':sic-gateway SESSION token-1');

    new Kernel({ type: 'close' }).handle();

    expect(endSessions).not.toHaveBeenCalled();
  });

  it('ends encrypted conversations with the connection when there is no gateway session', () => {
    const endSessions = vi.spyOn(e2eeSessionFile, 'endAllSessions').mockImplementation(() => {});

    new Kernel({ type: 'close' }).handle();

    expect(endSessions).toHaveBeenCalled();
  });

  it('carries encrypted conversations over a complete resume', () => {
    vi.spyOn(networksStore, 'setIsConnected').mockImplementation(() => {});
    const endSessions = vi.spyOn(e2eeSessionFile, 'endAllSessions').mockImplementation(() => {});
    resumeAttempt();

    raw(':sic-gateway RESUMED complete');

    expect(endSessions).not.toHaveBeenCalled();
  });

  it('refreshes channel rosters when part of the replay was lost', () => {
    const endSessions = vi.spyOn(e2eeSessionFile, 'endAllSessions').mockImplementation(() => {});
    vi.spyOn(networksStore, 'setIsConnected').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'getOpenChannelNames').mockImplementation(() => ['#one', '#two']);
    resumeAttempt();

    raw(':sic-gateway RESUMED partial');

    expect(sentLines()).toEqual(expect.arrayContaining(['NAMES #one', 'NAMES #two']));
    // A lost QUIT could mean someone else holds the peer's nick now
    expect(endSessions).toHaveBeenCalled();
    expect(channelsFile.setAddMessageToAllChannels).toHaveBeenCalledWith(
      expect.objectContaining({ message: i18next.t('kernel.resumedPartial') }),
    );
  });

  it('registers from scratch when the gateway no longer had the session', () => {
    resumeAttempt();

    raw(':sic-gateway SESSION token-2');

    expect(networkFile.resetConnectionState).toHaveBeenCalled();
    expect(sentLines()).toEqual(['CAP LS 302', 'NICK TestNick', 'USER TestNick 0 * :TestNick']);
    expect(beginGatewayConnection(true, target).query).toEqual({ resume: 'token-2', since: '0' });
  });

  it('registers and handles the line when the gateway has no session support', () => {
    const setNick = vi.spyOn(networksStore, 'setNick').mockImplementation(() => {});
    vi.spyOn(networksStore, 'setIsConnected').mockImplementation(() => {});
    resumeAttempt();

    raw(':irc.test 001 OtherNick :Welcome');

    expect(sentLines().slice(0, 3)).toEqual(['CAP LS 302', 'NICK TestNick', 'USER TestNick 0 * :TestNick']);
    expect(setNick).toHaveBeenCalledWith('OtherNick');
    expect(hasGatewaySession()).toBe(false);
  });

  it('ignores gateway-looking lines after the first one', () => {
    const setIsConnected = vi.spyOn(networksStore, 'setIsConnected').mockImplementation(() => {});
    beginGatewayConnection(false, target);
    raw(':sic-gateway SESSION token-1');

    raw(':sic-gateway SESSION spoofed');
    raw(':sic-gateway RESUMED complete');

    expect(beginGatewayConnection(true, target).query).toEqual({ resume: 'token-1', since: '0' });
    expect(setIsConnected).not.toHaveBeenCalled();
  });

  it('tracks the sequence number of relayed lines', () => {
    beginGatewayConnection(false, target);
    raw(':sic-gateway SESSION token-1');

    raw('@simpleircclient.com/seq=41;time=2026-01-01T00:00:00.000Z :irc.test NOTICE TestNick :hi');

    expect(beginGatewayConnection(true, target).query).toEqual({ resume: 'token-1', since: '41' });
  });
});
