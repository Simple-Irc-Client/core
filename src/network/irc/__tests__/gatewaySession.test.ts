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
} from '../gatewaySession';

describe('gatewaySession', () => {
  beforeEach(() => {
    forgetGatewaySession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for a new session when it holds none', () => {
    expect(beginGatewayConnection(true)).toEqual({ session: 'true' });
    expect(takeExpectedGatewayHello()).toBe('session');
  });

  it('resumes from the last line seen', () => {
    rememberGatewaySession('token-1');
    noteGatewaySeq('5');
    noteGatewaySeq('7');

    expect(beginGatewayConnection(true)).toEqual({ resume: 'token-1', since: '7' });
    expect(isAwaitingGatewayResume()).toBe(true);
  });

  it('ignores sequence numbers that are missing, invalid or older', () => {
    rememberGatewaySession('token-1');
    noteGatewaySeq('9');
    noteGatewaySeq('3');
    noteGatewaySeq(undefined);
    noteGatewaySeq('abc');
    noteGatewaySeq('1e400');

    expect(beginGatewayConnection(true)).toMatchObject({ since: '9' });
  });

  it('counts sequence numbers anew for a new session', () => {
    rememberGatewaySession('token-1');
    noteGatewaySeq('9');
    rememberGatewaySession('token-2');

    expect(beginGatewayConnection(true)).toEqual({ resume: 'token-2', since: '0' });
  });

  it('replaces its own session when a fresh connection is wanted', () => {
    rememberGatewaySession('token-1');

    expect(beginGatewayConnection(false)).toEqual({ session: 'true', replace: 'token-1' });
    expect(hasGatewaySession()).toBe(false);
  });

  it('replaces the session a previous page load of this tab left behind', () => {
    sessionStorage.setItem('sic-gateway-session', 'from-before-reload');

    expect(beginGatewayConnection(true)).toEqual({ session: 'true', replace: 'from-before-reload' });
  });

  it('hands out the expected hello only once', () => {
    beginGatewayConnection(false);

    expect(takeExpectedGatewayHello()).toBe('session');
    expect(takeExpectedGatewayHello()).toBeNull();
  });

  it('forgets the session in memory and in storage', () => {
    rememberGatewaySession('token-1');
    forgetGatewaySession();

    expect(hasGatewaySession()).toBe(false);
    expect(sessionStorage.getItem('sic-gateway-session')).toBeNull();
    expect(beginGatewayConnection(true)).toEqual({ session: 'true' });
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    rememberGatewaySession('token-1');

    expect(hasGatewaySession()).toBe(true);
    expect(beginGatewayConnection(false)).toEqual({ session: 'true', replace: 'token-1' });
    expect(beginGatewayConnection(false)).toEqual({ session: 'true' });
  });
});
