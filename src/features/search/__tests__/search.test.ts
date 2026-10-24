import { describe, expect, it } from 'vitest';
import { searchMessages } from '../search';
import { applySpoilerMarkup } from '@features/chat/spoilers';
import { IRC_FORMAT } from '@shared/lib/ircFormatting';
import { ChannelCategory, MessageCategory, type ChannelExtended, type Message } from '@shared/types';

const message = (id: string, text: string, fields: Partial<Message> = {}): Message => ({
  id,
  message: text,
  target: '#chan',
  time: '2024-01-01T12:00:00Z',
  category: MessageCategory.default,
  ...fields,
});

const channel = (name: string, messages: Message[], category: ChannelCategory = ChannelCategory.channel): ChannelExtended => ({
  name,
  category,
  unReadMessages: 0,
  messages,
  topic: '',
  topicSetBy: '',
  topicSetTime: 0,
  typing: [],
});

const ids = (channels: ChannelExtended[], query: string, inChannel?: string): string[] =>
  searchMessages(channels, query, inChannel).map((result) => result.message.id);

describe('searchMessages', () => {
  it('should find the query anywhere in a message, ignoring case, newest first across windows', () => {
    const channels = [
      channel('#rust', [message('old', 'Borrow checker', { time: '2024-01-01T10:00:00Z' }), message('other', 'unrelated')]),
      channel('alice', [message('new', 'the BORROWED book', { time: '2024-01-02T10:00:00Z' })], ChannelCategory.priv),
    ];

    expect(ids(channels, 'borrow')).toEqual(['new', 'old']);
  });

  it('should list messages of a window sharing a millisecond newest first', () => {
    expect(ids([channel('#a', [message('first', 'same time'), message('second', 'same time')])], 'same')).toEqual(['second', 'first']);
  });

  it('should ignore case beyond ASCII', () => {
    expect(ids([channel('#pl', [message('1', 'ŻÓŁW idzie')])], 'żółw')).toEqual(['1']);
  });

  it('should give where each match is, in the plain text', () => {
    const [result] = searchMessages([channel('#a', [message('1', `${IRC_FORMAT.BOLD}Go${IRC_FORMAT.BOLD} go GO`)])], 'go');

    expect(result?.text).toBe('Go go GO');
    expect(result?.matches).toEqual([[0, 2], [3, 5], [6, 8]]);
  });

  it('should take the query literally, trimmed', () => {
    const channels = [channel('#a', [message('1', 'what? (really)'), message('2', 'whatever')])];

    expect(ids(channels, '  t? (r ')).toEqual(['1']);
    expect(ids(channels, '.*')).toEqual([]);
  });

  it('should find nothing for an empty query', () => {
    expect(ids([channel('#a', [message('1', 'text')])], '   ')).toEqual([]);
  });

  it('should search only what people wrote', () => {
    const channels = [
      channel('#a', [
        message('said', 'hello'),
        message('acted', 'hello', { category: MessageCategory.me }),
        message('noticed', 'hello', { category: MessageCategory.notice }),
        message('joined', 'hello joined', { category: MessageCategory.join }),
        message('server', 'hello', { category: MessageCategory.info }),
      ]),
    ];

    expect(ids(channels, 'hello')).toEqual(['noticed', 'acted', 'said']);
  });

  it('should leave out deleted messages and encrypted ones that could not be read', () => {
    const channels = [
      channel('peer', [
        message('deleted', 'hello', { redacted: true }),
        message('decrypting', 'hello', { e2ee: 'decrypting' }),
        message('failed', 'hello', { e2ee: 'failed' }),
        message('decrypted', 'hello', { e2ee: 'ok' }),
      ], ChannelCategory.priv),
    ];

    expect(ids(channels, 'hello')).toEqual(['decrypted']);
  });

  it('should not find what a spoiler hides', () => {
    const channels = [channel('#a', [message('1', applySpoilerMarkup('the ||butler|| did it', null))])];

    expect(ids(channels, 'butler')).toEqual([]);
    expect(ids(channels, 'did it')).toEqual(['1']);
  });

  it('should leave out the Debug window, and search Status', () => {
    const channels = [
      channel('Debug', [message('raw', 'PRIVMSG #a :hello')], ChannelCategory.debug),
      channel('Status', [message('notice', 'hello', { category: MessageCategory.notice })], ChannelCategory.status),
    ];

    expect(ids(channels, 'hello')).toEqual(['notice']);
  });

  it('should search only the given window, whatever its case', () => {
    const channels = [channel('#Rust', [message('here', 'hello')]), channel('#go', [message('there', 'hello')])];

    expect(ids(channels, 'hello', '#rust')).toEqual(['here']);
  });
});
