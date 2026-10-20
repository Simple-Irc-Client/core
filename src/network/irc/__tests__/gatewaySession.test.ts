/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginGatewayConnection,
  forgetGatewaySession,
  hasGatewaySession,
  isAwaitingGatewayResume,
  noteGatewaySeq,
  rememberGatewaySession,
  takeExpectedGatewayHello,
  type GatewayTarget,
} from '../gatewaySession';

const plaintext: GatewayTarget = { host: 'irc.test.net', port: 6667, tls: false, encoding: 'utf8' };
const secure: GatewayTarget = { host: 'irc.test.net', port: 6697, tls: true, encoding: 'utf8' };

const startSession = (token: string, target: GatewayTarget = plaintext): void => {
  beginGatewayConnection(false, target);
  rememberGatewaySession(token);
};

describe('gatewaySession', () => {
  beforeEach(() => {
    forgetGatewaySession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for a new session when it holds none', () => {
    expect(beginGatewayConnection(true, plaintext).query).toEqual({ session: 'true' });
    expect(takeExpectedGatewayHello()).toBe('session');
  });

  it('resumes from the last line seen', () => {
    startSession('token-1');
    noteGatewaySeq('5');
    noteGatewaySeq('7');

    expect(beginGatewayConnection(true, plaintext).query).toEqual({ resume: 'token-1', since: '7' });
    expect(isAwaitingGatewayResume()).toBe(true);
  });

  it('ignores sequence numbers that are missing, invalid or older', () => {
    startSession('token-1');
    noteGatewaySeq('9');
    noteGatewaySeq('3');
    noteGatewaySeq(undefined);
    noteGatewaySeq('abc');
    noteGatewaySeq('1e400');

    expect(beginGatewayConnection(true, plaintext).query).toMatchObject({ since: '9' });
  });

  it('counts sequence numbers anew for a new session', () => {
    startSession('token-1');
    noteGatewaySeq('9');
    startSession('token-2');

    expect(beginGatewayConnection(true, plaintext).query).toEqual({ resume: 'token-2', since: '0' });
  });

  it('replaces its own session when a fresh connection is wanted', () => {
    startSession('token-1');

    expect(beginGatewayConnection(false, plaintext).query).toEqual({ session: 'true', replace: 'token-1' });
    expect(hasGatewaySession()).toBe(false);
  });

  it('replaces the session a previous page load of this tab left behind', () => {
    sessionStorage.setItem('sic-gateway-session', 'from-before-reload');

    expect(beginGatewayConnection(true, plaintext).query).toEqual({ session: 'true', replace: 'from-before-reload' });
  });

  it('resumes on the server the session is connected to, not the one asked for', () => {
    startSession('token-1', secure);

    expect(beginGatewayConnection(true, plaintext)).toEqual({ target: secure, query: { resume: 'token-1', since: '0' } });
  });

  it('starts a new session on the server asked for', () => {
    startSession('token-1', secure);

    expect(beginGatewayConnection(false, plaintext).target).toEqual(plaintext);
  });

  it('hands out the expected hello only once', () => {
    beginGatewayConnection(false, plaintext);

    expect(takeExpectedGatewayHello()).toBe('session');
    expect(takeExpectedGatewayHello()).toBeNull();
  });

  it('forgets the session in memory and in storage', () => {
    startSession('token-1');
    forgetGatewaySession();

    expect(hasGatewaySession()).toBe(false);
    expect(sessionStorage.getItem('sic-gateway-session')).toBeNull();
    expect(beginGatewayConnection(true, plaintext).query).toEqual({ session: 'true' });
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    startSession('token-1');

    expect(hasGatewaySession()).toBe(true);
    expect(beginGatewayConnection(false, plaintext).query).toEqual({ session: 'true', replace: 'token-1' });
    expect(beginGatewayConnection(false, plaintext).query).toEqual({ session: 'true' });
  });
});
