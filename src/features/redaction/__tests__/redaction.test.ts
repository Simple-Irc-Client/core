import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as network from '@/network/irc/network';
import * as capabilities from '@/network/irc/capabilities';
import * as channelsFile from '@features/channels/store/channels';
import { type Message, MessageCategory } from '@shared/types';
import { canRedactOthers, isRedactionEnabled, redacted, sendRedaction, setRedacted } from '../redaction';

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'local-1',
  msgid: 'm1',
  message: 'oops',
  nick: 'me',
  target: '#sic',
  time: '2026-10-24T10:00:00.000Z',
  category: MessageCategory.default,
  ...overrides,
});

describe('redaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('canRedactOthers', () => {
    it.each([['o'], ['a'], ['q'], ['v', 'o']])('lets an operator or higher delete anyone\'s message: %j', (...flags) => {
      expect(canRedactOthers(flags)).toBe(true);
    });

    it.each([[[]], [['v']], [['h']], [undefined]])('does not let others: %j', (flags) => {
      expect(canRedactOthers(flags)).toBe(false);
    });
  });

  it('is enabled with the draft/message-redaction capability', () => {
    const isEnabled = vi.spyOn(capabilities, 'isCapabilityEnabled').mockReturnValue(true);

    expect(isRedactionEnabled()).toBe(true);
    expect(isEnabled).toHaveBeenCalledWith('draft/message-redaction');
  });

  it('keeps a deleted message in its place, without its text and reactions', () => {
    expect(redacted(message({ reactions: [{ emoji: '👍', nicks: ['bob'] }] }))).toEqual({ ...message(), message: '', reactions: undefined, redacted: true });
  });

  describe('setRedacted', () => {
    it('marks the shown message deleted by its msgid', () => {
      vi.spyOn(channelsFile, 'getMessages').mockReturnValue([message()]);
      const update = vi.spyOn(channelsFile, 'setUpdateMessage').mockImplementation(() => {});

      setRedacted('#sic', 'm1');

      expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'local-1', { message: '', reactions: undefined, redacted: true });
    });

    it('does nothing for a message not shown', () => {
      vi.spyOn(channelsFile, 'getMessages').mockReturnValue([message()]);
      const update = vi.spyOn(channelsFile, 'setUpdateMessage').mockImplementation(() => {});

      setRedacted('#sic', 'other');

      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('sendRedaction', () => {
    it('asks the server to delete the message, replies going to its window', () => {
      const send = vi.spyOn(network, 'ircSendCommand').mockImplementation(() => true);

      sendRedaction(message());

      expect(send).toHaveBeenCalledExactlyOnceWith('REDACT #sic m1', { window: '#sic' });
    });

    it('sends nothing for a message without a msgid', () => {
      const send = vi.spyOn(network, 'ircSendCommand').mockImplementation(() => true);

      sendRedaction(message({ msgid: undefined }));

      expect(send).not.toHaveBeenCalled();
    });
  });
});
