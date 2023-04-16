/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { parseMessageToCommand } from '../command';

describe('command tests', () => {
  it('test away command', () => {
    expect(parseMessageToCommand('#channel', '/away message')).toStrictEqual('away message');
  });

  it('test join command', () => {
    expect(parseMessageToCommand('#channel', '/j #nextChannel')).toStrictEqual('JOIN #nextChannel');
    expect(parseMessageToCommand('#channel', '/JOIN #nextChannel')).toStrictEqual('JOIN #nextChannel');
  });

  it('test quit command', () => {
    expect(parseMessageToCommand('#channel', '/q reason1 reason2')).toStrictEqual('QUIT reason1 reason2');
    expect(parseMessageToCommand('#channel', '/QUIT')).toStrictEqual('QUIT Leaving');
  });

  it('test quote command', () => {
    expect(parseMessageToCommand('#channel', '/raw test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', '/quote test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', '/msg test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', '/MSG test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', 'test message')).toStrictEqual('test message');
  });

  it('test whereis command', () => {
    expect(parseMessageToCommand('#channel', '/whereis user1')).toStrictEqual('WHOIS user1');
  });

  it('test who command', () => {
    expect(parseMessageToCommand('#channel', '/who user1')).toStrictEqual('who user1');
  });

  it('test cycle command', () => {
    expect(parseMessageToCommand('#channel', '/cycle')).toStrictEqual('PART #channel\nJOIN #channel');
    expect(parseMessageToCommand('#channel', '/cycle reason 1')).toStrictEqual('PART #channel :reason 1\nJOIN #channel');
    expect(parseMessageToCommand('#channel', '/hop')).toStrictEqual('PART #channel\nJOIN #channel');
    expect(parseMessageToCommand('#channel', '/hop reason 1')).toStrictEqual('PART #channel :reason 1\nJOIN #channel');
  });

  it('test invite command', () => {
    expect(parseMessageToCommand('#channel', '/invite')).toStrictEqual('invite');
    expect(parseMessageToCommand('#channel', '/invite user1')).toStrictEqual('INVITE user1 #channel');
  });

  it('test kick command', () => {
    expect(parseMessageToCommand('#channel', '/kick')).toStrictEqual('kick');
    expect(parseMessageToCommand('#channel', '/kick user1')).toStrictEqual('KICK #channel user1');
    expect(parseMessageToCommand('#channel', '/kick user1 reason1 reason2')).toStrictEqual('KICK #channel user1 :reason1 reason2');
    expect(parseMessageToCommand('#channel', '/k')).toStrictEqual('k');
    expect(parseMessageToCommand('#channel', '/k user1')).toStrictEqual('KICK #channel user1');
    expect(parseMessageToCommand('#channel', '/k user1 reason1 reason2')).toStrictEqual('KICK #channel user1 :reason1 reason2');
  });

  it('test part command', () => {
    expect(parseMessageToCommand('#channel', '/part')).toStrictEqual('PART #channel');
    expect(parseMessageToCommand('#channel', '/part reason1 reason2')).toStrictEqual('PART #channel :reason1 reason2');
    expect(parseMessageToCommand('#channel', '/p')).toStrictEqual('PART #channel');
    expect(parseMessageToCommand('#channel', '/p reason1 reason2')).toStrictEqual('PART #channel :reason1 reason2');
  });

  it('test topic command', () => {
    expect(parseMessageToCommand('#channel', '/topic new topic')).toStrictEqual('TOPIC #channel :new topic');
  });
});
