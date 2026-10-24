import { IRC_FORMAT, type FormatState } from '@/shared/lib/ircFormatting';

const DELIMITER = '||';
const ESCAPED_DELIMITER = String.raw`\||`;
const TOKEN = /(\\\|\||\|\|)/;

// Grey on grey reads as a covered box on light and dark backgrounds alike
const SPOILER_OPEN = `${IRC_FORMAT.COLOR}14,14`;
// A bare color code followed by a digit would take the digit as a color: 99 is "default" and fills both slots
const DEFAULT_COLORS = '99,99';

/** Text in its own background color: hidden in any client, shown covered here */
export const isSpoiler = (style: FormatState): boolean =>
  style.foreground !== null && style.foreground.toLowerCase() === style.background?.toLowerCase();

const spoilerClose = (next: string | undefined, color: number | null): string => {
  if (color !== null) {
    return `${IRC_FORMAT.COLOR}${color.toString().padStart(2, '0')},99`;
  }
  return next !== undefined && /\d/.test(next) ? `${IRC_FORMAT.COLOR}${DEFAULT_COLORS}` : IRC_FORMAT.COLOR;
};

/** Turns each `||text||` into a spoiler, `\||` into a literal `||`; `color` is the line's own color to go back to */
export const applySpoilerMarkup = (text: string, color: number | null): string => {
  if (!text.includes(DELIMITER)) {
    return text;
  }

  const tokens: { delimiter: boolean; text: string }[] = [];
  for (const piece of text.split(TOKEN)) {
    if (piece === DELIMITER) {
      tokens.push({ delimiter: true, text: piece });
      continue;
    }
    const literal = piece === ESCAPED_DELIMITER ? DELIMITER : piece;
    const last = tokens.at(-1);
    if (last !== undefined && !last.delimiter) {
      last.text += literal;
    } else if (literal !== '') {
      tokens.push({ delimiter: false, text: literal });
    }
  }

  let result = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as (typeof tokens)[number];
    const content = tokens[i + 1];
    // The nearest closing `||` wins; an empty `||||` and an unmatched `||` stay literal
    if (token.delimiter && content !== undefined && !content.delimiter && tokens[i + 2]?.delimiter === true) {
      result += SPOILER_OPEN + content.text + spoilerClose(tokens[i + 3]?.text[0], color);
      i += 2;
    } else {
      result += token.text;
    }
  }
  return result;
};
