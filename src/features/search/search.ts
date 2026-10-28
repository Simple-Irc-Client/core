import { contentCategories } from '@features/chat/membershipEvents';
import { plainText } from '@features/chat/spoilers';
import { escapeRegExp } from '@shared/lib/highlight';
import { ChannelCategory, type ChannelExtended, type Message } from '@shared/types';
import { isSameName } from '@features/networks/store/networks';

export interface SearchResult {
  channel: ChannelExtended;
  message: Message;
  /** The message as plain text, spoilers masked */
  text: string;
  /** Where the query occurs in `text`: [start, end) */
  matches: [number, number][];
}

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
      const text = plainText(message.message);
      const matches = [...text.matchAll(pattern)].map((match): [number, number] => [match.index, match.index + match[0].length]);
      if (matches.length > 0) {
        results.push({ channel, message, text, matches });
      }
    }
  }

  return results.sort((a, b) => Date.parse(b.message.time) - Date.parse(a.message.time));
};
