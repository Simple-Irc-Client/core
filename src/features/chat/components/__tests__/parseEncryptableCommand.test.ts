import { describe, it, expect } from 'vitest';

import { BodyKind } from '@features/e2ee/protocol';

import { parseEncryptableCommand } from '../Toolbar';

/**
 * Guards the one place where a slash command could leak plaintext out of a
 * window the user is being told is encrypted.
 */
describe('parseEncryptableCommand', () => {
  it('routes /me through the encrypted path as an action', () => {
    expect(parseEncryptableCommand('PRIVMSG bob :\x01ACTION waves slowly\x01', 'bob')).toEqual({
      kind: BodyKind.action,
      body: 'waves slowly',
    });
  });

  it('routes a plain message to the peer through the encrypted path', () => {
    expect(parseEncryptableCommand('PRIVMSG bob :hello there', 'bob')).toEqual({
      kind: BodyKind.message,
      body: 'hello there',
    });
  });

  it('preserves a body containing colons and control codes', () => {
    expect(parseEncryptableCommand('PRIVMSG bob :see: \x02bold\x02 12:30', 'bob')).toEqual({
      kind: BodyKind.message,
      body: 'see: \x02bold\x02 12:30',
    });
  });

  it('handles an empty action body', () => {
    expect(parseEncryptableCommand('PRIVMSG bob :\x01ACTION \x01', 'bob')).toEqual({
      kind: BodyKind.action,
      body: '',
    });
  });

  it('leaves a message aimed at somebody else alone', () => {
    // `/msg carol ...` typed inside an encrypted window with bob is genuinely a
    // plaintext message to carol; encrypting it would send carol ciphertext she
    // has no session for.
    expect(parseEncryptableCommand('PRIVMSG carol :hello', 'bob')).toBeNull();
  });

  it('leaves a channel message alone', () => {
    expect(parseEncryptableCommand('PRIVMSG #chan :hello', 'bob')).toBeNull();
  });

  it('leaves a multi-line payload alone', () => {
    expect(parseEncryptableCommand('PRIVMSG bob :one\nPRIVMSG #chan :two', 'bob')).toBeNull();
  });

  it('leaves non-message commands alone', () => {
    expect(parseEncryptableCommand('WHOIS bob', 'bob')).toBeNull();
    expect(parseEncryptableCommand('NOTICE bob :hi', 'bob')).toBeNull();
    expect(parseEncryptableCommand('', 'bob')).toBeNull();
  });

  it('does not match a target that merely starts with the peer nick', () => {
    expect(parseEncryptableCommand('PRIVMSG bobby :hello', 'bob')).toBeNull();
  });
});
