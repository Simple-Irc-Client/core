// https://ircv3.net/specs/extensions/multiline

import { type BatchState, BATCH_TYPES } from '@/network/irc/batch';
import { getCapabilityValue, isCapabilityEnabled } from '@/network/irc/capabilities';
import { getMaxIrcMessageLength } from '@/network/irc/network';
import { type ParsedIrcRawMessage } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

export const MULTILINE_CAP = 'draft/multiline';

/** Joins a line to the previous one without a line break */
export const MULTILINE_CONCAT_TAG = 'draft/multiline-concat';

export interface MultilineLimits {
  maxBytes: number;
  maxLines: number;
}

/** One message as sent: its text, and the raw lines that carry it */
export interface OutgoingMessage {
  text: string;
  /** Raw lines; the first one carries the label */
  lines: [string, ...string[]];
}

// The relayed line starts with `:nick!user@host `; user and host are counted at their usual maximum lengths
const MAX_USER_LENGTH = 10;
const MAX_HOST_LENGTH = 63;

const encoder = new TextEncoder();
const byteLength = (text: string): number => encoder.encode(text).length;

/** From the capability value, e.g. `max-bytes=4096,max-lines=100`; undefined when batches can't be sent */
export const getMultilineLimits = (): MultilineLimits | undefined => {
  if (!isCapabilityEnabled(MULTILINE_CAP) || !isCapabilityEnabled('batch')) {
    return undefined;
  }
  const params = new Map((getCapabilityValue(MULTILINE_CAP) ?? '').split(',').map((param) => {
    const [key = '', value = ''] = param.split('=');
    return [key, value];
  }));
  const maxBytes = Number(params.get('max-bytes'));
  const maxLines = Number(params.get('max-lines'));
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    return undefined;
  }
  return { maxBytes, maxLines: Number.isInteger(maxLines) && maxLines > 0 ? maxLines : Number.POSITIVE_INFINITY };
};

/** The bytes of text one PRIVMSG from `nick` to `target` can carry once the server relays it */
export const privmsgTextBudget = (nick: string, target: string): number =>
  getMaxIrcMessageLength() - byteLength(`:${nick}!${'u'.repeat(MAX_USER_LENGTH)}@${'h'.repeat(MAX_HOST_LENGTH)} PRIVMSG ${target} :`);

/** Where the first piece of `text` ends: all of it if it fits, else after the last space that fits */
const pieceEnd = (text: string, maxBytes: number): number => {
  if (byteLength(text) <= maxBytes) {
    return text.length;
  }
  let end = 0;
  let bytes = 0;
  for (const char of text) {
    bytes += byteLength(char);
    // A character larger than the budget still makes a piece of its own
    if (bytes > maxBytes && end > 0) {
      break;
    }
    end += char.length;
  }
  const space = text.lastIndexOf(' ', end - 1);
  // The space stays at the end of the piece, so joining the pieces gives the line back
  return space > 0 ? space + 1 : end;
};

/** Splits a line into pieces of at most `maxBytes`, after a space where there is one, never inside a character */
export const splitLine = (line: string, maxBytes: number): string[] => {
  const pieces: string[] = [];
  let rest = line;
  do {
    const end = pieceEnd(rest, maxBytes);
    pieces.push(rest.slice(0, end));
    rest = rest.slice(end);
  } while (rest !== '');
  return pieces;
};

interface Piece {
  text: string;
  /** Continues the previous piece's line */
  concat: boolean;
}

/** Groups the pieces into messages that keep within the limits, without blank lines at their edges */
const packPieces = (pieces: Piece[], limits: MultilineLimits): Piece[][] => {
  const messages: Piece[][] = [];
  let current: Piece[] = [];
  let bytes = 0;
  for (const piece of pieces) {
    const added = byteLength(piece.text) + (current.length > 0 && !piece.concat ? 1 : 0);
    if (current.length > 0 && (current.length >= limits.maxLines || bytes + added > limits.maxBytes)) {
      messages.push(current);
      current = [];
      bytes = 0;
    }
    if (current.length === 0 && piece.text === '') {
      continue;
    }
    // A message starting with a continuation starts a line of its own
    current.push(current.length === 0 ? { text: piece.text, concat: false } : piece);
    bytes += current.length === 1 ? byteLength(piece.text) : added;
  }
  messages.push(current);
  return messages
    .map((message) => message.slice(0, message.findLastIndex((piece) => piece.text !== '') + 1))
    .filter((message) => message.length > 0);
};

const joinPieces = (pieces: Piece[]): string =>
  pieces.map((piece, index) => (index === 0 || piece.concat ? piece.text : `\n${piece.text}`)).join('');

/**
 * The messages that send `text` to `target`. With draft/multiline each message is one batch, or a plain
 * PRIVMSG when it fits one line; without it every line goes as its own PRIVMSG. `tags` go on the first message.
 */
export const buildPrivmsgs = (nick: string, target: string, text: string, tags?: string): OutgoingMessage[] => {
  const limits = getMultilineLimits();
  const budget = Math.min(privmsgTextBudget(nick, target), limits?.maxBytes ?? Number.POSITIVE_INFINITY);
  const pieces = text.split('\n').flatMap((line) =>
    line === '' ? [{ text: '', concat: false }] : splitLine(line, budget).map((piece, index) => ({ text: piece, concat: index > 0 })));

  const messages: Piece[][] = limits === undefined
    ? pieces.filter((piece) => piece.text !== '').map((piece) => [{ text: piece.text, concat: false }])
    : packPieces(pieces, limits);

  return messages.map((message, index) => {
    const messageTags = index === 0 ? tags : undefined;
    const withTags = (line: string): string => (messageTags === undefined ? line : `${messageTags} ${line}`);
    const [first] = message;
    if (message.length === 1 && first !== undefined) {
      return { text: first.text, lines: [withTags(`PRIVMSG ${target} :${first.text}`)] };
    }
    const reference = uuidv4();
    return {
      text: joinPieces(message),
      lines: [
        withTags(`BATCH +${reference} ${BATCH_TYPES.MULTILINE} ${target}`),
        ...message.map((piece) => `@batch=${reference}${piece.concat ? `;${MULTILINE_CONCAT_TAG}` : ''} PRIVMSG ${target} :${piece.text}`),
        `BATCH -${reference}`,
      ],
    };
  });
};

const trailingText = (params: string[]): string => {
  const text = params.join(' ');
  return text.startsWith(':') ? text.slice(1) : text;
};

/**
 * A received multiline batch as the one message it carries, with the opening line's tags.
 * Undefined when its lines don't make one message: mixed commands, senders or targets, or CTCP.
 */
export const combineMultiline = (batch: BatchState): ParsedIrcRawMessage | undefined => {
  const target = batch.params[0];
  const [first] = batch.messages;
  if (target === undefined || first === undefined || (first.command !== 'PRIVMSG' && first.command !== 'NOTICE')) {
    return undefined;
  }

  const pieces: Piece[] = [];
  for (const message of batch.messages) {
    const [lineTarget, ...params] = message.line;
    const text = trailingText(params);
    if (message.command !== first.command || message.sender !== first.sender || lineTarget !== target || text.startsWith('\x01')) {
      return undefined;
    }
    pieces.push({ text, concat: MULTILINE_CONCAT_TAG in message.tags });
  }

  const tags = Object.fromEntries(Object.entries({ ...first.tags, ...batch.tags })
    .filter(([key]) => key !== 'batch' && key !== MULTILINE_CONCAT_TAG));
  return { tags, sender: first.sender, command: first.command, line: [target, `:${joinPieces(pieces)}`] };
};
