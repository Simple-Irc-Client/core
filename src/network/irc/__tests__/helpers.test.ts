/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { type Server } from '../servers';
import { type UserMode } from '../../../types';
import { calculateMaxPermission, parseChannel, parseIrcRawMessage, parseNick, parseServer, parseUserModes } from '../helpers';

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
        { host: 'irc.example.com', port: 6667 },
      ],
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['irc1.example.com', 'irc1.example.com'],
        },
        { host: 'irc1.example.com', port: 6667 },
      ],
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['irc1.example.com:1234', 'irc1.example.com:567'],
        },
        { host: 'irc1.example.com', port: 1234 },
      ],
      [
        {
          default: 0,
          encoding: 'utf8',
          flags: 19,
          network: 'test',
          servers: ['irc1.example.com:', 'irc1.example.com:'],
        },
        { host: 'irc1.example.com', port: 6667 },
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

  it('should test parseUserModes', () => {
    expect(parseUserModes('')).toStrictEqual([]);
    expect(parseUserModes(undefined)).toStrictEqual([]);
    expect(parseUserModes('(v)+')).toStrictEqual([{ symbol: '+', flag: 'v' }]);
    expect(parseUserModes('(x)')).toStrictEqual([]); // incorrect
    expect(parseUserModes('()*')).toStrictEqual([]); // incorrect
  });
});
