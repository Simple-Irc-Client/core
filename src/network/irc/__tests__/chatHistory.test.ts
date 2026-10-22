import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maxViewedMessages } from '@/config/config';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '../capabilities';
import * as networkFile from '../network';
import { clearHistoryRequests, onHistoryBatch, onHistoryFailed, pendingHistoryAnchor, requestLatestHistory, requestOlderHistory } from '../chatHistory';
import * as channelsFile from '@features/channels/store/channels';
import * as settingsFile from '@features/settings/store/settings';
import { ChannelCategory, type Message, MessageCategory } from '@shared/types';

const at = (minute: number): string => `2026-10-22T10:${String(minute).padStart(2, '0')}:00.000Z`;
const ms = (minute: number): number => Date.parse(at(minute));
/** Timestamp bounds go 1ms past the anchor, so messages sharing its millisecond are asked for too */
const before = (time: number) => ({ timestamp: new Date(time + 1).toISOString() });
const after = (time: number) => ({ timestamp: new Date(time - 1).toISOString() });

/** `null`: a local notice, with no nick */
const message = (minute: number, nick: string | null = 'Friend'): Message => ({
  id: `m${minute}-${nick ?? 'local'}`,
  message: 'text',
  nick: nick ?? undefined,
  target: '#chan',
  time: at(minute),
  category: MessageCategory.default,
});

describe('chatHistory', () => {
  let send: ReturnType<typeof vi.spyOn>;
  let messages: Message[];

  beforeEach(() => {
    clearHistoryRequests();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['draft/chathistory']);
    messages = [];
    send = vi.spyOn(networkFile, 'ircRequestChatHistory').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'getMessages').mockImplementation(() => messages);
    vi.spyOn(channelsFile, 'getCategory').mockImplementation((name) => (name.startsWith('#') ? ChannelCategory.channel : ChannelCategory.priv));
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestLatestHistory', () => {
    it('asks for the latest page of a window with nothing in it yet', () => {
      requestLatestHistory('#chan');

      expect(send).toHaveBeenCalledExactlyOnceWith('#chan', 'LATEST', undefined, 50);
    });

    it('asks only for what came after the newest message from others, by time', () => {
      messages = [message(1), message(5), message(9, 'MyNick'), message(8, null)];

      requestLatestHistory('#chan');

      expect(send).toHaveBeenCalledExactlyOnceWith('#chan', 'LATEST', after(ms(5)), 50);
    });

    it('asks nothing of a server without chathistory', () => {
      resetCapabilityState();

      requestLatestHistory('#chan');

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('catching up after a reconnect', () => {
    beforeEach(() => {
      messages = [message(1)];
      requestLatestHistory('#chan');
    });

    it('pages back from the oldest message of a full page until it reaches the newest one it had', () => {
      onHistoryBatch('#chan', 50, { time: ms(30), msgid: 'm30' });
      expect(send).toHaveBeenLastCalledWith('#chan', 'BEFORE', { msgid: 'm30' }, 50);

      onHistoryBatch('#chan', 50, { time: ms(1), msgid: 'm1' });
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('pages back by time from a server without msgids', () => {
      onHistoryBatch('#chan', 50, { time: ms(30) });

      expect(send).toHaveBeenLastCalledWith('#chan', 'BEFORE', before(ms(30)), 50);
    });

    it('pages through a burst sharing one millisecond by msgid', () => {
      onHistoryBatch('#chan', 50, { time: ms(30), msgid: 'm30b' });
      onHistoryBatch('#chan', 50, { time: ms(30), msgid: 'm30a' });

      expect(send).toHaveBeenLastCalledWith('#chan', 'BEFORE', { msgid: 'm30a' }, 50);
    });

    it('stops when, by time alone, a full page gets no further back than the last one', () => {
      onHistoryBatch('#chan', 50, { time: ms(30) });
      onHistoryBatch('#chan', 50, { time: ms(30) });

      expect(send).toHaveBeenCalledTimes(2);
    });

    it('stops when a page is not full', () => {
      onHistoryBatch('#chan', 3, { time: ms(2) });

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('stops once more would only be trimmed away', () => {
      for (let page = 1; page <= 10; page++) {
        onHistoryBatch('#chan', 50, { time: ms(59 - page) });
      }

      // 300 kept messages are 6 pages
      expect(send).toHaveBeenCalledTimes(6);
    });

    it('does not take a short catch-up answer for the start of history', () => {
      onHistoryBatch('#chan', 1, { time: ms(31) });

      requestOlderHistory('#chan');

      expect(send).toHaveBeenLastCalledWith('#chan', 'BEFORE', before(ms(1)), 50);
    });
  });

  describe('with a server that caps a request (ISUPPORT CHATHISTORY)', () => {
    it('asks for no more than the cap, and takes a full capped page for more to come', () => {
      vi.spyOn(settingsFile, 'getChatHistoryLimit').mockImplementation(() => 20);
      messages = [message(1)];
      requestLatestHistory('#chan');
      expect(send).toHaveBeenLastCalledWith('#chan', 'LATEST', after(ms(1)), 20);

      onHistoryBatch('#chan', 20, { time: ms(40) });

      expect(send).toHaveBeenLastCalledWith('#chan', 'BEFORE', before(ms(40)), 20);
    });
  });

  describe('requestOlderHistory', () => {
    it('asks for the page before the oldest message from others', () => {
      messages = [message(3, null), message(4, 'MyNick'), message(5), message(6)];

      requestOlderHistory('#chan');

      expect(send).toHaveBeenCalledExactlyOnceWith('#chan', 'BEFORE', before(ms(5)), 50);
    });

    it('anchors on the oldest message id once the server has shown it tags history with msgids', () => {
      requestLatestHistory('#chan');
      onHistoryBatch('#chan', 50, { time: ms(5), msgid: 'm5-Friend' });
      messages = [message(5), message(6)];

      requestOlderHistory('#chan');

      expect(send).toHaveBeenLastCalledWith('#chan', 'BEFORE', { msgid: 'm5-Friend' }, 50);
    });

    it('tells which message the outstanding request pages back from', () => {
      requestLatestHistory('#chan');
      expect(pendingHistoryAnchor('#chan')).toBeUndefined();
      onHistoryBatch('#chan', 50, { time: ms(5), msgid: 'm5-Friend' });
      messages = [message(5)];

      requestOlderHistory('#chan');

      expect(pendingHistoryAnchor('#CHAN')).toBe('m5-Friend');
      onHistoryBatch('#chan', 50, { time: ms(4), msgid: 'm4-Friend' });
      expect(pendingHistoryAnchor('#chan')).toBeUndefined();
    });

    it('asks once while a request for the window is out', () => {
      messages = [message(5)];

      requestOlderHistory('#chan');
      requestOlderHistory('#CHAN');

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('asks again once the answer is in', () => {
      messages = [message(5)];
      requestOlderHistory('#chan');
      onHistoryBatch('#chan', 50, { time: ms(3) });
      messages = [message(3), message(5)];

      requestOlderHistory('#chan');

      expect(send).toHaveBeenLastCalledWith('#chan', 'BEFORE', before(ms(3)), 50);
    });

    it('stops at the start of history', () => {
      messages = [message(5)];
      requestOlderHistory('#chan');
      onHistoryBatch('#chan', 2, { time: ms(3) });
      messages = [message(3), message(4), message(5)];

      requestOlderHistory('#chan');

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('asks again when trimming dropped messages after the start of history', () => {
      messages = [message(5)];
      requestOlderHistory('#chan');
      onHistoryBatch('#chan', 2, { time: ms(3) });
      messages = [message(7)];

      requestOlderHistory('#chan');

      expect(send).toHaveBeenLastCalledWith('#chan', 'BEFORE', before(ms(7)), 50);
    });

    it('stops when the server has nothing older', () => {
      messages = [message(5)];
      requestOlderHistory('#chan');
      onHistoryBatch('#chan', 0, undefined);

      requestOlderHistory('#chan');

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('stops when the server has nothing at all for the window', () => {
      requestLatestHistory('#chan');
      onHistoryBatch('#chan', 0, undefined);
      messages = [message(5)];

      requestOlderHistory('#chan');

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('stops after the server refused', () => {
      messages = [message(5)];
      requestOlderHistory('#chan');
      onHistoryFailed('#chan');

      requestOlderHistory('#chan');

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('does not page past what a window can show', () => {
      messages = Array.from({ length: maxViewedMessages - 49 }, () => message(5));

      requestOlderHistory('#chan');

      expect(send).not.toHaveBeenCalled();
    });

    it('asks nothing for the status window or a window with only local messages', () => {
      vi.spyOn(channelsFile, 'getCategory').mockImplementation(() => ChannelCategory.status);
      messages = [message(5)];
      requestOlderHistory('Status');

      vi.spyOn(channelsFile, 'getCategory').mockImplementation(() => ChannelCategory.channel);
      messages = [message(5, null)];
      requestOlderHistory('#chan');

      expect(send).not.toHaveBeenCalled();
    });

    it('ignores a batch nobody asked for', () => {
      onHistoryBatch('#chan', 50, { time: ms(59) });
      onHistoryFailed('#chan');
      messages = [message(5)];

      requestOlderHistory('#chan');

      expect(send).toHaveBeenCalledExactlyOnceWith('#chan', 'BEFORE', before(ms(5)), 50);
    });
  });
});
