/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { type Server } from '../servers';
import { type UserMode } from '@shared/types';
import { calculateMaxPermission, parseChannel, parseIrcRawMessage, parseNick, parseServer, parseUserModes, unescapeTagValue } from '../helpers';

describe('helper tests', () => {
  const defaultUserModes = [
    { symbol: '!', flag: 'y' }, // LibraIRC
    { symbol: '~', flag: 'q' },
    { symbol: '&', flag: 'a' },
    { symbol: '@', flag: 'o' },
    { symbol: '%', flag: 'h' },
    { symbol: '+', flag: 'v' },
  ];

  it('test parse server', () => {
    const tests = [
      [{}, undefined],
      [undefined, undefined],
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: [],
        },
        undefined,
      ],
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['irc.example.com'],
        },
        { host: 'irc.example.com', port: 6667, tls: false },
      ],
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['irc1.example.com', 'irc1.example.com'],
        },
        { host: 'irc1.example.com', port: 6667, tls: false },
      ],
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['irc1.example.com:1234', 'irc1.example.com:567'],
        },
        { host: 'irc1.example.com', port: 1234, tls: false },
      ],
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['irc1.example.com:', 'irc1.example.com:'],
        },
        { host: 'irc1.example.com', port: 6667, tls: false },
      ],
      // TLS with + prefix
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['+irc.example.com'],
        },
        { host: 'irc.example.com', port: 6697, tls: true },
      ],
      // TLS with + prefix and custom port
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['+irc.example.com:7000'],
        },
        { host: 'irc.example.com', port: 7000, tls: true },
      ],
      // TLS from server config
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['irc.example.com'],
          tls: true,
        },
        { host: 'irc.example.com', port: 6697, tls: true },
      ],
    ];
    for (const test of tests) {
      const server = test?.[0];
      const result = test?.[1];

      expect(parseServer(server as Server)).toStrictEqual(result);
    }
  });

  it('test parse irc raw message', () => {
    expect(parseIrcRawMessage(':dsfsdfsdfsdf MODE dsfsdfsdfsdf :+x\r\n')).toStrictEqual({
      tags: {},
      sender: 'dsfsdfsdfsdf',
      command: 'MODE',
      line: ['dsfsdfsdfsdf', ':+x'],
    });
    expect(
      parseIrcRawMessage('@draft/bot;msgid=MmlMsf9ZUy2zEzoBc8IQLV;time=2023-02-05T19:02:00.003Z :NickServ!NickServ@serwisy.pirc.pl NOTICE dsfsdfsdfsdf :Twoj nick nie jest zarejestrowany'),
    ).toStrictEqual({
      tags: {
        'draft/bot': '',
        msgid: 'MmlMsf9ZUy2zEzoBc8IQLV',
        time: '2023-02-05T19:02:00.003Z',
      },
      sender: 'NickServ!NickServ@serwisy.pirc.pl',
      command: 'NOTICE',
      line: ['dsfsdfsdfsdf', ':Twoj', 'nick', 'nie', 'jest', 'zarejestrowany'],
    });
    expect(parseIrcRawMessage(':netsplit.pirc.pl 002 dsfsdfsdfsdf :Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3\r\n')).toStrictEqual({
      tags: {},
      sender: 'netsplit.pirc.pl',
      command: '002',
      line: ['dsfsdfsdfsdf', ':Your', 'host', 'is', 'netsplit.pirc.pl,', 'running', 'version', 'UnrealIRCd-6.0.3'],
    });
  });

  it('test parse channel', () => {
    expect(parseChannel('@#channel1', defaultUserModes)).toStrictEqual('#channel1');
    expect(parseChannel('!@+#channel1', defaultUserModes)).toStrictEqual('#channel1');
  });

  it('test parse nick', () => {
    expect(parseNick('nick!ident@hostname', [])).toStrictEqual({
      flags: [],
      nick: 'nick',
      ident: 'ident',
      hostname: 'hostname',
    });
    expect(
      parseNick('@+nick!ident@hostname', [
        { symbol: '@', flag: 'o' },
        { symbol: '+', flag: 'v' },
      ]),
    ).toStrictEqual({
      flags: ['o', 'v'],
      nick: 'nick',
      ident: 'ident',
      hostname: 'hostname',
    });
    expect(parseNick(':netsplit.pirc.pl', [])).toStrictEqual({
      flags: [],
      nick: 'netsplit.pirc.pl',
      ident: '',
      hostname: '',
    });
  });

  it('parseNick strips control characters', () => {
    expect(parseNick('ni\x00ck\x01!\x02ident@hostname', [])).toStrictEqual({
      flags: [],
      nick: 'nick',
      ident: '\x02ident',
      hostname: 'hostname',
    });
  });

  it('parseNick strips all control chars leaving fallback', () => {
    expect(parseNick('\x01\x02\x03!ident@hostname', [])).toStrictEqual({
      flags: [],
      nick: '*',
      ident: 'ident',
      hostname: 'hostname',
    });
  });

  it('parseNick truncates long nicks to 100 chars', () => {
    const longNick = 'a'.repeat(200) + '!ident@hostname';
    const result = parseNick(longNick, []);
    expect(result.nick.length).toBe(100);
    expect(result.nick).toBe('a'.repeat(100));
  });

  it('should test calculateMaxPermission', () => {
    const serverModes: UserMode[] = [
      { symbol: '~', flag: 'q' },
      { symbol: '&', flag: 'a' },
      { symbol: '@', flag: 'o' },
      { symbol: '%', flag: 'h' },
      { symbol: '+', flag: 'v' },
    ];

    expect(calculateMaxPermission(['q'], serverModes)).toEqual(256);
    expect(calculateMaxPermission(['a'], serverModes)).toEqual(255);
    expect(calculateMaxPermission(['o'], serverModes)).toEqual(254);
    expect(calculateMaxPermission(['h'], serverModes)).toEqual(253);
    expect(calculateMaxPermission(['v'], serverModes)).toEqual(252);
    expect(calculateMaxPermission(['xyz'], serverModes)).toEqual(-1);
    expect(calculateMaxPermission([], serverModes)).toEqual(-1);
  });

  describe('unescapeTagValue', () => {
    it('should unescape IRCv3 tag value escape sequences', () => {
      expect(unescapeTagValue('hello\\sworld')).toBe('hello world');
      expect(unescapeTagValue('semi\\:colon')).toBe('semi;colon');
      expect(unescapeTagValue('back\\\\slash')).toBe('back\\slash');
      expect(unescapeTagValue('cr\\rreturn')).toBe('cr\rreturn');
      expect(unescapeTagValue('new\\nline')).toBe('new\nline');
    });

    it('should handle multiple escape sequences', () => {
      expect(unescapeTagValue('a\\sb\\:c\\\\d')).toBe('a b;c\\d');
    });

    it('should pass through strings without escapes', () => {
      expect(unescapeTagValue('hello')).toBe('hello');
      expect(unescapeTagValue('')).toBe('');
      expect(unescapeTagValue('2023-02-01T23:08:26.026Z')).toBe('2023-02-01T23:08:26.026Z');
    });

    it('should handle unknown escape sequences by dropping backslash', () => {
      expect(unescapeTagValue('\\x')).toBe('x');
    });

    it('should handle trailing backslash', () => {
      // A lone trailing backslash is kept as-is (no character to escape)
      expect(unescapeTagValue('trail\\')).toBe('trail\\');
    });
  });

  it('parseIrcRawMessage should unescape tag values', () => {
    const result = parseIrcRawMessage('@key=hello\\sworld :server COMMAND param');
    expect(result.tags['key']).toBe('hello world');
  });

  it('should test parseUserModes', () => {
    expect(parseUserModes('')).toStrictEqual([]);
    expect(parseUserModes(undefined)).toStrictEqual([]);
    expect(parseUserModes('(v)+')).toStrictEqual([{ symbol: '+', flag: 'v' }]);
    expect(parseUserModes('(x)')).toStrictEqual([]); // incorrect
    expect(parseUserModes('()*')).toStrictEqual([]); // incorrect
  });
});
