/**
 * Matches a single emoji "cluster": one base emoji, optionally followed by a
 * skin-tone modifier or chained with ZWJ into a combined emoji (e.g. family,
 * profession sequences), plus flags (regional indicator pairs) and keycaps
 * (digit/#/* + combining enclosing keycap).
 */
const EMOJI_PATTERN =
  '(?:\\p{Regional_Indicator}{2}' +
  '|[0-9#*]\\uFE0F?\\u20E3' +
  '|(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})\\uFE0F?(?:\\p{Emoji_Modifier})?' +
  '(?:\\u200D(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})\\uFE0F?(?:\\p{Emoji_Modifier})?)*)';

const EMOJI_REGEX = new RegExp(EMOJI_PATTERN, 'gu');

export interface TextRun {
  text: string;
  isEmoji: boolean;
}

/** Splits text into alternating plain-text and emoji runs, in order. */
export function splitEmoji(text: string): TextRun[] {
  if (!text) { return []; }

  const runs: TextRun[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(EMOJI_REGEX)) {
    const index = match.index;
    if (index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, index), isEmoji: false });
    }
    runs.push({ text: match[0], isEmoji: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), isEmoji: false });
  }
  return runs;
}
