import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addIgnore, isIgnoredSender, toIgnoreMask } from '../ignore';
import { useIgnoreStore } from '../store/ignore';
import { connectTestNetwork, setTestSession } from '@/test/networks';

const part = (pattern: RegExp) => fc.stringMatching(pattern);
const nick = part(/^[A-Za-z[\]\\`_^{|}][A-Za-z0-9[\]\\`_^{|}-]{0,15}$/);
const user = part(/^~?[a-z0-9]{1,10}$/);
const host = part(/^[a-z0-9.:-]{1,30}$/);

describe('ignoring, for any sender', () => {
  beforeEach(() => {
    connectTestNetwork({ network: 'test', servers: ['irc.test'], default: 0, encoding: 'utf8' });
    setTestSession({ nick: 'me', caseMapping: 'rfc1459' });
    useIgnoreStore.setState({ masksByNetwork: {} });
  });

  it('a mask made from an entry always has a nick, a user and a host', () => {
    fc.assert(fc.property(fc.string(), (entry) => {
      const mask = toIgnoreMask(entry);
      if (mask !== undefined) {
        expect(mask).toMatch(/^[^!@\s]+![^!@\s]+@[^@\s]+$/);
      }
    }));
  });

  it('ignoring a nick ignores its messages, whatever the user, host and case', () => {
    fc.assert(fc.property(nick, user, host, (who, ident, hostname) => {
      fc.pre(who.toLowerCase() !== 'me');
      useIgnoreStore.setState({ masksByNetwork: {} });
      expect(addIgnore(who)).toBe(true);
      expect(isIgnoredSender(`:${who.toUpperCase()}!${ident}@${hostname}`)).toBe(true);
    }));
  });

  it('ignoring a host ignores whoever writes from it, and no one else', () => {
    fc.assert(fc.property(nick, user, host, host, (who, ident, hostname, otherHost) => {
      fc.pre(who.toLowerCase() !== 'me' && hostname !== otherHost);
      useIgnoreStore.setState({ masksByNetwork: {} });
      addIgnore(`*@${hostname}`);
      expect(isIgnoredSender(`${who}!${ident}@${hostname}`)).toBe(true);
      expect(isIgnoredSender(`${who}!${ident}@${otherHost}`)).toBe(false);
    }));
  });

  it('a server is never ignored', () => {
    fc.assert(fc.property(host, (server) => {
      addIgnore('*');
      expect(isIgnoredSender(server)).toBe(false);
    }));
  });
});
