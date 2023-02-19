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
    expect(parseMessageToCommand('#channel', '/QUIT')).toStrictEqual('QUIT Simple Irc Client ( https://simpleircclient.com )');
  });

  it('test quote command', () => {
    expect(parseMessageToCommand('#channel', '/MSG test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', 'test message')).toStrictEqual('test message');
  });

  it('test whois command', () => {
    expect(parseMessageToCommand('#channel', '/whois user1')).toStrictEqual('WHOIS user1');
    expect(parseMessageToCommand('#channel', '/whereis user1')).toStrictEqual('WHOIS user1');
  });

  it('test who command', () => {
    expect(parseMessageToCommand('#channel', '/who user1')).toStrictEqual('WHO user1');
  });

  it('test topic command', () => {
    expect(parseMessageToCommand('#channel', '/topic new topic')).toStrictEqual('TOPIC #channel new topic');
  });
});
