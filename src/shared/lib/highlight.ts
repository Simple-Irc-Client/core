export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const WORD_CHAR = '[\\p{L}\\p{N}\\p{M}]';

/** Whether any of the terms appears in the text as a whole word, ignoring case */
export const containsHighlight = (text: string, terms: string[]): boolean => {
  const patterns = terms.map((term) => term.trim()).filter((term) => term !== '').map(escapeRegExp);
  if (patterns.length === 0) {
    return false;
  }
  return new RegExp(`(?<!${WORD_CHAR})(?:${patterns.join('|')})(?!${WORD_CHAR})`, 'iu').test(text);
};
