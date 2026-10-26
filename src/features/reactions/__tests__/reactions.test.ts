import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasReacted, sendReaction, setReaction, withReaction } from '../reactions';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import * as networkFile from '@/network/irc/network';
import * as channelsFile from '@features/channels/store/channels';
import * as networksStore from '@features/networks/store/networks';
import { type Message, MessageCategory, type Reaction } from '@shared/types';

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  msgid: 'm1',
  message: 'hello',
  nick: 'alice',
  target: '#sic',
  time: '2026-10-23T10:00:00.000Z',
  category: MessageCategory.default,
  ...overrides,
});

describe('reactions', () => {
  beforeEach(() => {
    vi.spyOn(networksStore, 'isSameName').mockImplementation((a, b) => a.toLowerCase() === b.toLowerCase());
    vi.spyOn(networksStore, 'getCurrentNick').mockImplementation(() => 'me');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCapabilityState();
  });

  describe('withReaction', () => {
    it('adds a new reaction after the others', () => {
      expect(withReaction([{ emoji: '👍', nicks: ['bob'] }], '😂', 'alice', true)).toEqual([
        { emoji: '👍', nicks: ['bob'] },
        { emoji: '😂', nicks: ['alice'] },
      ]);
    });

    it('starts the list for a message without reactions', () => {
      expect(withReaction(undefined, '👍', 'alice', true)).toEqual([{ emoji: '👍', nicks: ['alice'] }]);
    });

    it('adds a nick to a reaction given already', () => {
      expect(withReaction([{ emoji: '👍', nicks: ['bob'] }], '👍', 'alice', true)).toEqual([{ emoji: '👍', nicks: ['bob', 'alice'] }]);
    });

    it('keeps the same list for a reaction given twice, whatever the nick case', () => {
      const reactions: Reaction[] = [{ emoji: '👍', nicks: ['Alice'] }];

      expect(withReaction(reactions, '👍', 'alice', true)).toBe(reactions);
    });

    it('takes a nick back, and the reaction once nobody gives it', () => {
      const reactions: Reaction[] = [{ emoji: '👍', nicks: ['alice', 'bob'] }, { emoji: '😂', nicks: ['Alice'] }];

      expect(withReaction(reactions, '😂', 'alice', false)).toEqual([{ emoji: '👍', nicks: ['alice', 'bob'] }]);
      expect(withReaction(reactions, '👍', 'bob', false)).toEqual([{ emoji: '👍', nicks: ['alice'] }, { emoji: '😂', nicks: ['Alice'] }]);
    });

    it('has none left once the last reaction is taken back', () => {
      expect(withReaction([{ emoji: '👍', nicks: ['alice'] }], '👍', 'alice', false)).toBeUndefined();
    });

    it('keeps the same list when taking back a reaction never given', () => {
      const reactions: Reaction[] = [{ emoji: '👍', nicks: ['bob'] }];

      expect(withReaction(reactions, '👍', 'alice', false)).toBe(reactions);
      expect(withReaction(reactions, '😂', 'alice', false)).toBe(reactions);
      expect(withReaction(undefined, '😂', 'alice', false)).toBeUndefined();
    });
  });

  it('hasReacted ignores nick case', () => {
    expect(hasReacted({ emoji: '👍', nicks: ['Alice'] }, 'alice')).toBe(true);
    expect(hasReacted({ emoji: '👍', nicks: ['Alice'] }, 'bob')).toBe(false);
  });

  describe('setReaction', () => {
    it('updates the message with that msgid', () => {
      vi.spyOn(channelsFile, 'getMessages').mockImplementation(() => [message({ id: 'other', msgid: 'other' }), message()]);
      const update = vi.spyOn(channelsFile, 'setUpdateMessage').mockImplementation(() => {});

      setReaction('#sic', 'm1', '👍', 'bob', true);

      expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', { reactions: [{ emoji: '👍', nicks: ['bob'] }] });
    });

    it('does nothing for a message not shown, or one without a msgid', () => {
      vi.spyOn(channelsFile, 'getMessages').mockImplementation(() => [message({ id: 'm1', msgid: undefined })]);
      const update = vi.spyOn(channelsFile, 'setUpdateMessage').mockImplementation(() => {});

      setReaction('#sic', 'm1', '👍', 'bob', true);
      setReaction('#sic', 'unknown', '👍', 'bob', true);

      expect(update).not.toHaveBeenCalled();
    });

    it('does not update when nothing changes', () => {
      vi.spyOn(channelsFile, 'getMessages').mockImplementation(() => [message({ reactions: [{ emoji: '👍', nicks: ['bob'] }] })]);
      const update = vi.spyOn(channelsFile, 'setUpdateMessage').mockImplementation(() => {});

      setReaction('#sic', 'm1', '👍', 'bob', true);

      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('sendReaction', () => {
    let send: ReturnType<typeof vi.spyOn>;
    let update: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      update = vi.spyOn(channelsFile, 'setUpdateMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'getMessages').mockImplementation(() => [message()]);
    });

    it('sends the reaction to the message\'s window and waits for the echo', () => {
      markCapabilitiesAcknowledged(['message-tags', 'echo-message']);

      sendReaction(message(), '👍', true);

      expect(send).toHaveBeenCalledExactlyOnceWith('@+draft/react=👍;+draft/reply=m1 TAGMSG #sic');
      expect(update).not.toHaveBeenCalled();
    });

    it('takes a reaction back with unreact', () => {
      markCapabilitiesAcknowledged(['message-tags', 'echo-message']);

      sendReaction(message({ target: 'bob' }), '👍', false);

      expect(send).toHaveBeenCalledExactlyOnceWith('@+draft/unreact=👍;+draft/reply=m1 TAGMSG bob');
    });

    it('shows it at once on a server that will not echo it', () => {
      markCapabilitiesAcknowledged(['message-tags']);

      sendReaction(message(), '👍', true);

      expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', { reactions: [{ emoji: '👍', nicks: ['me'] }] });
    });

    it('escapes a text reaction for the tag', () => {
      markCapabilitiesAcknowledged(['message-tags', 'echo-message']);

      sendReaction(message(), 'well; ok', true);

      expect(send).toHaveBeenCalledExactlyOnceWith(String.raw`@+draft/react=well\:\sok;+draft/reply=m1 TAGMSG #sic`);
    });

    it('sends nothing for a message without a msgid', () => {
      markCapabilitiesAcknowledged(['message-tags']);

      sendReaction(message({ msgid: undefined }), '👍', true);

      expect(send).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  });
});
