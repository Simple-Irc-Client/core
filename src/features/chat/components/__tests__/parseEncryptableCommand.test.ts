import { afterEach, describe, it, expect } from 'vitest';

import { BodyKind } from '@features/e2ee/protocol';
import { setSession, removeSession } from '@features/e2ee/store/e2ee';
import { E2eeState } from '@features/e2ee/store/e2ee';

import { gateOutgoingCommand } from '../Toolbar';

const activate = (nick: string): void => {
  setSession(nick, { state: E2eeState.active, verified: false, myFingerprint: 'x' });
};

/**
 * Guards the one place where a slash command's raw wire output could leak
 * plaintext out of a window the user is being told is encrypted — this reads
 * the actual PRIVMSG/NOTICE line about to be sent, not the command name, so
 * it also has to catch commands that aren't in an explicit allowlist.
 */
describe('gateOutgoingCommand', () => {
  afterEach(() => {
    removeSession('bob');
  });

  it('routes /me through the encrypted path as an action', () => {
    activate('bob');
    expect(gateOutgoingCommand('PRIVMSG bob :\x01ACTION waves slowly\x01')).toEqual({
      verdict: 'encrypt',
      kind: BodyKind.action,
      body: 'waves slowly',
    });
  });

  it('routes a plain message to the peer through the encrypted path', () => {
    activate('bob');
    expect(gateOutgoingCommand('PRIVMSG bob :hello there')).toEqual({
      verdict: 'encrypt',
      kind: BodyKind.message,
      body: 'hello there',
    });
  });

  it('preserves a body containing colons and control codes', () => {
    activate('bob');
    expect(gateOutgoingCommand('PRIVMSG bob :see: \x02bold\x02 12:30')).toEqual({
      verdict: 'encrypt',
      kind: BodyKind.message,
      body: 'see: \x02bold\x02 12:30',
    });
  });

  it('handles an empty action body', () => {
    activate('bob');
    expect(gateOutgoingCommand('PRIVMSG bob :\x01ACTION \x01')).toEqual({
      verdict: 'encrypt',
      kind: BodyKind.action,
      body: '',
    });
  });

  it('blocks a /notice to a peer with an active session instead of leaking it', () => {
    activate('bob');
    expect(gateOutgoingCommand('NOTICE bob :hi')).toEqual({ verdict: 'block' });
  });

  it('leaves a message aimed at somebody with no session alone', () => {
    // `/msg carol ...` typed inside an encrypted window with bob is genuinely a
    // plaintext message to carol; encrypting it would send carol ciphertext she
    // has no session for.
    activate('bob');
    expect(gateOutgoingCommand('PRIVMSG carol :hello')).toBeNull();
  });

  it('leaves a notice to somebody with no session alone', () => {
    activate('bob');
    expect(gateOutgoingCommand('NOTICE carol :hello')).toBeNull();
  });

  it('leaves a channel message alone', () => {
    expect(gateOutgoingCommand('PRIVMSG #chan :hello')).toBeNull();
  });

  it('leaves a multi-line payload alone even when the peer has a session', () => {
    activate('bob');
    expect(gateOutgoingCommand('PRIVMSG bob :one\nPRIVMSG #chan :two')).toBeNull();
  });

  it('leaves non-message commands alone', () => {
    activate('bob');
    expect(gateOutgoingCommand('WHOIS bob')).toBeNull();
    expect(gateOutgoingCommand('')).toBeNull();
  });

  it('does nothing once the session is no longer active', () => {
    expect(gateOutgoingCommand('PRIVMSG bob :hello')).toBeNull();
    expect(gateOutgoingCommand('NOTICE bob :hello')).toBeNull();
  });

  it('does not match a target that merely starts with the peer nick', () => {
    activate('bob');
    expect(gateOutgoingCommand('PRIVMSG bobby :hello')).toBeNull();
  });
});
