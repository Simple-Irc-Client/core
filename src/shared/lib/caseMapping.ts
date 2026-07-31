/**
 * IRC names (channels and nicks) are case-insensitive, but *which* characters
 * count as the same letter depends on the server's CASEMAPPING. IRC grew out of
 * Scandinavian ASCII, where `{}|^` are the lowercase forms of `[]\~`, so the
 * default mapping folds those too.
 *
 * Comparing names with a plain `===` makes one channel look like two windows as
 * soon as the server echoes a casing different from the one we sent (we send
 * `JOIN #religie`, the server replies with its canonical `#Religie`).
 */
export type CaseMapping = 'ascii' | 'rfc1459' | 'rfc1459-strict';

/** RFC 1459/2812 mandate rfc1459 when the server advertises no CASEMAPPING */
export const DEFAULT_CASE_MAPPING: CaseMapping = 'rfc1459';

const CASE_MAPPINGS: CaseMapping[] = ['ascii', 'rfc1459', 'rfc1459-strict'];

const isCaseMapping = (value: string): value is CaseMapping => (CASE_MAPPINGS as string[]).includes(value);

/** Unknown/absent values fall back to the spec default rather than disabling folding */
export const parseCaseMapping = (value: string | undefined): CaseMapping => {
  const normalized = value?.toLowerCase();
  return normalized !== undefined && isCaseMapping(normalized) ? normalized : DEFAULT_CASE_MAPPING;
};

const UPPER_A = 0x41;
const UPPER_Z = 0x5a;
// The contiguous run [ \ ] , whose lowercase forms are the equally contiguous { | }
const BRACKET_OPEN = 0x5b;
const BRACKET_CLOSE = 0x5d;
const TILDE = 0x7e; //         ~ -> ^
const CARET = 0x5e;
const TO_LOWER = 0x20;

/**
 * Casefold a channel name or nick for identity comparison.
 *
 * Deliberately not `String.toLowerCase()`: that folds non-ASCII too (and is
 * locale-sensitive for a few code points), which would make names the server
 * considers distinct compare equal.
 */
export const foldName = (name: string, mapping: CaseMapping = DEFAULT_CASE_MAPPING): string => {
  let folded = '';

  for (const char of name) {
    const code = char.codePointAt(0) ?? 0;

    if (code >= UPPER_A && code <= UPPER_Z) {
      folded += String.fromCodePoint(code + TO_LOWER);
    } else if (mapping !== 'ascii' && code >= BRACKET_OPEN && code <= BRACKET_CLOSE) {
      folded += String.fromCodePoint(code + TO_LOWER);
    } else if (mapping === 'rfc1459' && code === TILDE) {
      folded += String.fromCodePoint(CARET);
    } else {
      folded += char;
    }
  }

  return folded;
};

/** Do two IRC names refer to the same channel/user? */
export const namesEqual = (a: string, b: string, mapping: CaseMapping = DEFAULT_CASE_MAPPING): boolean => {
  // Fast path: identical strings are by far the common case, and folding both
  // sides runs on every incoming message against every open channel
  return a === b || foldName(a, mapping) === foldName(b, mapping);
};
