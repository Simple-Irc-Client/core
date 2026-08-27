/**
 * ICAO/NATO phonetic alphabet, mapped onto the 16 hex digits: 0-9 spelled as
 * plain digit words, A-F as the first six NATO letters. This is an
 * internationally standardized way to read an unambiguous string aloud over
 * a phone or radio — more globally recognizable than an arbitrary word list,
 * since it doesn't lean on English vocabulary or US place names to be
 * memorable. `crypto.ts` uses this to spell a fingerprint's hex digits one
 * word per nibble, in place of reading the raw hex characters.
 */
export const NATO_HEX_WORDS: readonly string[] = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
  'Eight', 'Nine', 'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot',
];
