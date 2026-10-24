import { contentCategories } from '@features/chat/membershipEvents';
import { isSpoiler } from '@features/chat/spoilers';
import { isSameName } from '@features/settings/store/settings';
import { escapeRegExp } from '@shared/lib/highlight';
import { hasIrcFormatting, parseIrcFormatting } from '@shared/lib/ircFormatting';
import { ChannelCategory, type ChannelExtended, type Message } from '@shared/types';

/** Stands in for a spoiler's text, which search neither shows nor finds */
export const SPOILER_MASK = '▒▒▒';

export interface SearchResult {
  channel: ChannelExtended;
  message: Message;
  /** The message as plain text, spoilers masked */
  text: string;
  /** Where the query occurs in `text`: [start, end) */
  matches: [number, number][];
}

/** The message as plain text: formatting dropped, each spoiler masked */
export const searchableText = (message: string): string => {
  if (!hasIrcFormatting(message)) {
    return message;
  }
  let text = '';
  let inSpoiler = false;
  for (const segment of parseIrcFormatting(message)) {
    const spoiler = isSpoiler(segment.style);
    if (!spoiler) {
      text += segment.text;
    } else if (!inSpoiler) {
      text += SPOILER_MASK;
    }
    inSpoiler = spoiler;
  }
  return text;
};

// What someone wrote and can be read; a message still decrypting or that failed to has no text of its own
const isSearchable = (message: Message): boolean =>
  contentCategories.has(message.category) && message.redacted !== true && (message.e2ee === undefined || message.e2ee === 'ok');

/** Messages in the open windows (only `inChannel` when given) that contain the query, ignoring case; newest first */
export const searchMessages = (channels: ChannelExtended[], query: string, inChannel?: string): SearchResult[] => {
  const needle = query.trim();
  if (needle === '') {
    return [];
  }
  const pattern = new RegExp(escapeRegExp(needle), 'giu');
  const results: SearchResult[] = [];

  for (const channel of channels) {
    // Debug holds raw protocol lines, not conversation
    if (channel.category === ChannelCategory.debug || (inChannel !== undefined && !isSameName(channel.name, inChannel))) {
      continue;
    }
    // Newest first, so messages sharing a millisecond keep that order through the stable sort
    for (const message of [...channel.messages].reverse()) {
      if (!isSearchable(message)) {
        continue;
      }
      const text = searchableText(message.message);
      const matches = [...text.matchAll(pattern)].map((match): [number, number] => [match.index, match.index + match[0].length]);
      if (matches.length > 0) {
        results.push({ channel, message, text, matches });
      }
    }
  }

  return results.sort((a, b) => Date.parse(b.message.time) - Date.parse(a.message.time));
};
