import { beforeEach, describe, expect, it } from 'vitest';
import { addIgnore, getIgnoreMasks, isIgnoredMask, isIgnoredSender, removeIgnore, toIgnoreMask } from '../ignore';
import { useIgnoreStore } from '../store/ignore';
import { useSettingsStore } from '@features/settings/store/settings';

const server = (network: string) => ({ default: 0, encoding: 'utf8', network, servers: ['irc.test:6667'] });

describe('ignore', () => {
  beforeEach(() => {
    localStorage.clear();
    useIgnoreStore.setState({ masksByNetwork: {} });
    useSettingsStore.setState({ server: server('TestNet'), nick: 'Me', caseMapping: 'rfc1459' });
  });

  describe('toIgnoreMask', () => {
    it('should complete a bare nick to any address', () => {
      expect(toIgnoreMask('troll')).toBe('troll!*@*');
      expect(toIgnoreMask('  troll  ')).toBe('troll!*@*');
    });

    it('should complete partial masks', () => {
      expect(toIgnoreMask('troll!~t')).toBe('troll!~t@*');
      expect(toIgnoreMask('~t@bad.host')).toBe('*!~t@bad.host');
      expect(toIgnoreMask('*@bad.host')).toBe('*!*@bad.host');
      expect(toIgnoreMask('troll!@')).toBe('troll!*@*');
    });

    it('should keep a full mask', () => {
      expect(toIgnoreMask('t*ll!?t@*.host')).toBe('t*ll!?t@*.host');
    });

    it('should reject what is not a mask', () => {
      expect(toIgnoreMask('')).toBeUndefined();
      expect(toIgnoreMask('   ')).toBeUndefined();
      expect(toIgnoreMask('two words')).toBeUndefined();
      expect(toIgnoreMask('a@b@c')).toBeUndefined();
      expect(toIgnoreMask('a!b!c@d')).toBeUndefined();
    });
  });

  describe('the list', () => {
    it('should add, dedupe per CASEMAPPING and remove masks of the current network', () => {
      expect(addIgnore('Troll')).toBe(true);
      expect(addIgnore('troll!*@*')).toBe(true);
      expect(addIgnore('[bot]')).toBe(true);
      expect(addIgnore('{BOT}')).toBe(true);

      expect(getIgnoreMasks()).toEqual(['Troll!*@*', '[bot]!*@*']);
      expect(isIgnoredMask('TROLL')).toBe(true);

      expect(removeIgnore('troll')).toBe(true);
      expect(getIgnoreMasks()).toEqual(['[bot]!*@*']);
    });

    it('should keep each network its own list, and persist it', () => {
      addIgnore('troll');
      useSettingsStore.setState({ server: server('OtherNet') });

      expect(getIgnoreMasks()).toEqual([]);
      expect(isIgnoredSender(':troll!t@host')).toBe(false);
      expect(JSON.parse(localStorage.getItem('sic-ignore') ?? '{}').state.masksByNetwork).toEqual({ TestNet: ['troll!*@*'] });
    });

    it('should refuse an invalid entry, or one with no network', () => {
      expect(addIgnore('two words')).toBe(false);
      useSettingsStore.setState({ server: undefined });
      expect(addIgnore('troll')).toBe(false);
      expect(getIgnoreMasks()).toEqual([]);
    });

    it('should report removing what is not on the list', () => {
      addIgnore('troll');

      expect(removeIgnore('someone')).toBe(false);
      expect(removeIgnore('two words')).toBe(false);
      expect(getIgnoreMasks()).toEqual(['troll!*@*']);
    });
  });

  describe('isIgnoredSender', () => {
    it('should match a nick whatever its address and case', () => {
      addIgnore('troll');

      expect(isIgnoredSender(':Troll!~t@host.example')).toBe(true);
      expect(isIgnoredSender('troll!x@y')).toBe(true);
      expect(isIgnoredSender(':trolling!~t@host.example')).toBe(false);
    });

    it('should match wildcards against the whole address', () => {
      addIgnore('*!*@*.spam.example');
      addIgnore('bot??');

      expect(isIgnoredSender(':anyone!u@a.spam.example')).toBe(true);
      expect(isIgnoredSender(':anyone!u@spam.example.org')).toBe(false);
      expect(isIgnoredSender(':bot42!u@h')).toBe(true);
      expect(isIgnoredSender(':bot4!u@h')).toBe(false);
    });

    it('should fold names per CASEMAPPING', () => {
      addIgnore('[troll]');

      expect(isIgnoredSender(':{TROLL}!u@h')).toBe(true);
    });

    it('should treat regular expression characters in a mask literally', () => {
      addIgnore('a.b');

      expect(isIgnoredSender(':a.b!u@h')).toBe(true);
      expect(isIgnoredSender(':axb!u@h')).toBe(false);
    });

    it('should never ignore a server or ourselves', () => {
      addIgnore('*!*@*');
      addIgnore('*');

      expect(isIgnoredSender(':irc.example.net')).toBe(false);
      expect(isIgnoredSender('')).toBe(false);
      expect(isIgnoredSender(':me!u@h')).toBe(false);
      expect(isIgnoredSender(':other!u@h')).toBe(true);
    });

    it('should ignore nobody with an empty list', () => {
      expect(isIgnoredSender(':troll!t@h')).toBe(false);
    });
  });
});
