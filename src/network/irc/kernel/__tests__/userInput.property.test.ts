/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import { getUser, setAddUser, setUsersClearAll } from '@features/users/store/users';
import { parseMessageToCommand } from '@/network/irc/command';
import { isSafeCssColor, isSafeImageUrl, isSafeUrl } from '@shared/lib/utils';
import { setupKernelTest } from './fixtures';
import { setTestSession } from '@/test/networks';

/** What fits in one IRC line's trailing parameter: anything but a line break or NUL */
const lineText = fc.string({ unit: 'binary', maxLength: 80 }).map((text) => text.replace(/[\r\n\0]/g, ''));
const url = fc.oneof(
  fc.webUrl({ withQueryParameters: true, withFragments: true }),
  fc.tuple(fc.constantFrom('javascript:', 'JavaScript:', 'data:', 'vbscript:', 'file:', 'about:', ' javascript:', 'java\tscript:', 'ftp:', '//'), lineText).map(([scheme, rest]) => scheme + rest),
  lineText,
);

describe('what users type, for any value', () => {
  setupKernelTest();

  const handle = (line: string) => new Kernel({ type: 'raw', line }).handle();
  const alice = () => getUser('alice');

  beforeEach(() => {
    setTestSession({ nick: 'me', caseMapping: 'rfc1459' });
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    setUsersClearAll();
    setAddUser({ nick: 'alice', ident: 'a', hostname: 'host', flags: [], channels: [{ name: '#chan', flags: [], maxPermission: -1 }] });
  });

  it('a display name or status is kept as written, an empty one cleared', () => {
    fc.assert(fc.property(fc.constantFrom('display-name', 'status'), lineText, (key, value) => {
      handle(`:server METADATA alice ${key} * :${value}`);
      expect(alice()?.[key === 'display-name' ? 'displayName' : 'status']).toBe(value === '' ? undefined : value);
    }));
  });

  it('a homepage is kept only as an http or https address', () => {
    fc.assert(fc.property(url, (value) => {
      handle(':server METADATA alice homepage * :');
      handle(`:server METADATA alice homepage * :${value}`);
      const kept = alice()?.homepage;
      expect(kept === undefined || (isSafeUrl(kept) && /^https?:/i.test(new URL(kept).protocol))).toBe(true);
    }));
  });

  it('an avatar is kept only as a safe image address', () => {
    fc.assert(fc.property(url, (value) => {
      handle(':server METADATA alice avatar * :');
      handle(`:server 761 me alice avatar * :${value}`);
      const kept = alice()?.avatar;
      expect(kept === undefined || isSafeImageUrl(kept)).toBe(true);
    }));
  });

  it('a nick color is kept only as a safe CSS color', () => {
    fc.assert(fc.property(fc.oneof(lineText, fc.constantFrom('red', '#ff0000', 'rgb(1,2,3)', 'red;background:url(x)', 'expression(alert(1))')), (value) => {
      handle(':server METADATA alice color * :');
      handle(`:server METADATA alice color * :${value}`);
      const kept = alice()?.color;
      expect(kept === undefined || isSafeCssColor(kept)).toBe(true);
    }));
  });

  it('an away message is kept as written, and coming back clears it', () => {
    fc.assert(fc.property(lineText.filter((text) => text !== '' && text !== '*'), (reason) => {
      handle(`:alice!a@host AWAY :${reason}`);
      expect(alice()).toMatchObject({ away: true, awayReason: reason });
      handle(':alice!a@host AWAY');
      expect(alice()?.away).toBe(false);
    }));
  });

  it('any metadata key and value is taken without throwing', () => {
    fc.assert(fc.property(fc.string({ maxLength: 20 }), fc.string({ unit: 'binary', maxLength: 100 }), (key, value) => {
      expect(() => handle(`:server METADATA alice ${key} * :${value}`)).not.toThrow();
      expect(() => handle(`:server 760 me alice ${key} * :${value}`)).not.toThrow();
    }));
  });

  it('a command typed by the user never sends a second IRC line', () => {
    const typed = fc.string({ unit: 'binary', maxLength: 80 });
    const command = fc.constantFrom('/away', '/msg alice', '/notice alice', '/me', '/topic', '/nick', '/quit', '/raw PRIVMSG alice :', '/ns IDENTIFY', '/whois');
    fc.assert(fc.property(command, typed, (prefix, text) => {
      expect(parseMessageToCommand('#chan', `${prefix} ${text}`)).not.toMatch(/[\r\n]/);
    }));
  });
});
