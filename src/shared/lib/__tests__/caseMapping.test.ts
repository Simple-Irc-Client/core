import { describe, expect, it } from 'vitest';
import { DEFAULT_CASE_MAPPING, foldName, namesEqual, parseCaseMapping, type CaseMapping } from '@shared/lib/caseMapping';

describe('caseMapping', () => {
  describe('parseCaseMapping', () => {
    it('should accept the mappings defined by the specs', () => {
      expect(parseCaseMapping('ascii')).toBe('ascii');
      expect(parseCaseMapping('rfc1459')).toBe('rfc1459');
      expect(parseCaseMapping('rfc1459-strict')).toBe('rfc1459-strict');
    });

    it('should accept a value in any casing', () => {
      expect(parseCaseMapping('ASCII')).toBe('ascii');
      expect(parseCaseMapping('RFC1459-Strict')).toBe('rfc1459-strict');
    });

    it('should fall back to the spec default when 005 omits CASEMAPPING', () => {
      expect(parseCaseMapping(undefined)).toBe(DEFAULT_CASE_MAPPING);
      expect(DEFAULT_CASE_MAPPING).toBe('rfc1459');
    });

    it('should fall back to the spec default for an unknown mapping', () => {
      // A server advertising something we don't implement must not silently
      // turn folding off - that would resurrect the duplicate-window bug
      expect(parseCaseMapping('utf8')).toBe(DEFAULT_CASE_MAPPING);
      expect(parseCaseMapping('')).toBe(DEFAULT_CASE_MAPPING);
    });
  });

  describe('foldName', () => {
    it.each<CaseMapping>(['ascii', 'rfc1459', 'rfc1459-strict'])('should fold A-Z under %s', (mapping) => {
      expect(foldName('#Religie', mapping)).toBe('#religie');
      expect(foldName('#RELIGIE', mapping)).toBe('#religie');
      expect(foldName('#religie', mapping)).toBe('#religie');
    });

    it('should leave the channel prefix and digits alone', () => {
      expect(foldName('#Chan-42_x', 'ascii')).toBe('#chan-42_x');
      expect(foldName('&Local', 'ascii')).toBe('&local');
    });

    it('should not fold the Scandinavian characters under ascii', () => {
      expect(foldName('#a[b]c\\d~e', 'ascii')).toBe('#a[b]c\\d~e');
    });

    it('should fold []\\ to {}| under rfc1459-strict', () => {
      expect(foldName('#a[b]c\\d', 'rfc1459-strict')).toBe('#a{b}c|d');
    });

    it('should leave ~ alone under rfc1459-strict', () => {
      // rfc1459-strict is exactly rfc1459 minus the ~/^ pair
      expect(foldName('nick~', 'rfc1459-strict')).toBe('nick~');
    });

    it('should fold []\\~ to {}|^ under rfc1459', () => {
      expect(foldName('#a[b]c\\d~e', 'rfc1459')).toBe('#a{b}c|d^e');
    });

    it('should default to the spec mapping when none is given', () => {
      expect(foldName('#A[B]')).toBe(foldName('#A[B]', DEFAULT_CASE_MAPPING));
    });

    it('should be idempotent', () => {
      expect(foldName(foldName('#Re[li]gie~', 'rfc1459'), 'rfc1459')).toBe(foldName('#Re[li]gie~', 'rfc1459'));
    });

    it('should not fold non-ASCII letters', () => {
      // toLowerCase() would turn these into a different name than the server has
      expect(foldName('#ŻÓŁĆ', 'ascii')).toBe('#ŻÓŁĆ');
      expect(foldName('#Łódź', 'rfc1459')).toBe('#Łódź');
    });

    it('should not fold the Turkish dotted capital I into an ASCII i', () => {
      // 'İ'.toLowerCase() yields 'i̇' (i + combining dot), which would make two
      // distinct names compare equal
      expect(foldName('İ', 'ascii')).toBe('İ');
      expect(foldName('İ', 'ascii')).not.toBe('i');
    });

    it('should handle an empty name', () => {
      expect(foldName('', 'rfc1459')).toBe('');
    });

    it('should preserve characters outside the BMP', () => {
      expect(foldName('#chan-😀', 'rfc1459')).toBe('#chan-😀');
    });
  });

  describe('namesEqual', () => {
    it('should match the same channel written in different casings', () => {
      expect(namesEqual('#religie', '#Religie', 'ascii')).toBe(true);
      expect(namesEqual('#RELIGIE', '#religie', 'rfc1459')).toBe(true);
    });

    it('should not match different channels', () => {
      expect(namesEqual('#religie', '#religia', 'rfc1459')).toBe(false);
      expect(namesEqual('#religie', '##religie', 'rfc1459')).toBe(false);
      expect(namesEqual('#religie', 'religie', 'rfc1459')).toBe(false);
    });

    it('should apply the Scandinavian equivalence only where the mapping does', () => {
      expect(namesEqual('#a[b]', '#a{b}', 'rfc1459')).toBe(true);
      expect(namesEqual('#a[b]', '#a{b}', 'rfc1459-strict')).toBe(true);
      expect(namesEqual('#a[b]', '#a{b}', 'ascii')).toBe(false);

      expect(namesEqual('nick~', 'nick^', 'rfc1459')).toBe(true);
      expect(namesEqual('nick~', 'nick^', 'rfc1459-strict')).toBe(false);
    });

    it('should compare nicks the same way as channels', () => {
      expect(namesEqual('Merovingian', 'merovingian', 'ascii')).toBe(true);
      expect(namesEqual('NickServ', 'nickserv', 'rfc1459')).toBe(true);
    });

    it('should treat identical strings as equal without depending on the mapping', () => {
      expect(namesEqual('#Religie', '#Religie', 'ascii')).toBe(true);
      expect(namesEqual('', '', 'ascii')).toBe(true);
    });

    it('should never merge names that differ under ascii but match under rfc1459', () => {
      // The persisted-store migration relies on this: ascii is the conservative
      // subset, so folding with it can only ever merge true duplicates
      expect(namesEqual('#a[b]', '#a{b}', 'ascii')).toBe(false);
      expect(namesEqual('#a[b]', '#a{b}', 'rfc1459')).toBe(true);
    });
  });
});
