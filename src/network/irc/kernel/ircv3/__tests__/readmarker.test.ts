/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import * as networkFile from '@/network/irc/network';
import { clearReadMarkers, getReadMarker, noteShownMessage } from '@/network/irc/readMarkers';
import * as channelsFile from '@features/channels/store/channels';
import * as networksStore from '@features/networks/store/networks';
import { type Message, MessageCategory } from '@shared/types';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

const message = (id: string, time: string, fields: Partial<Message> = {}): Message => ({
  id,
  message: 'text',
  nick: 'Friend',
  target: '#chan',
  time,
  category: MessageCategory.default,
  ...fields,
});

describe('kernel ircv3/readmarker', () => {
  setupKernelTest();

  const mockEnvironment = (messages: Message[] = []) => {
    vi.spyOn(networksStore, 'getCurrentNick').mockImplementation(() => 'MyNick');
    vi.spyOn(networksStore, 'getCurrentChannelName').mockImplementation(() => '#current');
    vi.spyOn(channelsFile, 'existChannel').mockImplementation((name) => name !== '#unknown');
    vi.spyOn(channelsFile, 'getMessages').mockImplementation(() => messages);
    return {
      setUnreadMessages: vi.spyOn(channelsFile, 'setUnreadMessages').mockImplementation(() => {}),
      ircSendRawMessage: vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {}),
    };
  };

  const handle = (line: string): void => {
    new Kernel({ type: 'raw', line }).handle();
  };

  beforeEach(() => {
    clearReadMarkers();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['draft/read-marker']);
  });

  it('counts only messages from others after the marker as unread', () => {
    const mocks = mockEnvironment([
      message('read', '2026-10-22T10:00:00.000Z', { highlight: true }),
      message('after', '2026-10-22T10:00:02.000Z'),
      message('action', '2026-10-22T10:00:03.000Z', { category: MessageCategory.me }),
      message('own', '2026-10-22T10:00:04.000Z', { nick: { nick: 'mynick', ident: '', hostname: '', flags: [], channels: [] } }),
      message('join', '2026-10-22T10:00:05.000Z', { category: MessageCategory.join }),
      message('notice', '2026-10-22T10:00:06.000Z', { category: MessageCategory.notice }),
      message('system', '2026-10-22T10:00:07.000Z', { system: true }),
    ]);

    handle('@time=2026-10-22T10:00:09.000Z :ergo.test MARKREAD #chan timestamp=2026-10-22T10:00:01.000Z');

    expect(getReadMarker('#chan')).toBe('2026-10-22T10:00:01.000Z');
    expect(mocks.setUnreadMessages).toHaveBeenCalledExactlyOnceWith('#chan', 2, false);
  });

  it('keeps the mention badge only for a mention after the marker', () => {
    const mocks = mockEnvironment([
      message('old', '2026-10-22T10:00:00.000Z', { highlight: true }),
      message('new', '2026-10-22T10:00:02.000Z', { highlight: true }),
    ]);

    handle(':ergo.test MARKREAD #chan timestamp=2026-10-22T10:00:01.000Z');
    expect(mocks.setUnreadMessages).toHaveBeenLastCalledWith('#chan', 1, true);

    handle(':ergo.test MARKREAD #chan timestamp=2026-10-22T10:00:02.000Z');
    expect(mocks.setUnreadMessages).toHaveBeenLastCalledWith('#chan', 0, false);
  });

  it('applies a marker for a private conversation to its window', () => {
    const mocks = mockEnvironment([message('dm', '2026-10-22T10:00:02.000Z', { target: 'Friend' })]);

    handle(':ergo.test MARKREAD Friend timestamp=2026-10-22T10:00:03.000Z');

    expect(mocks.setUnreadMessages).toHaveBeenCalledExactlyOnceWith('Friend', 0, false);
  });

  it('answers a marker for the window being read with what it has shown since', () => {
    const mocks = mockEnvironment();
    noteShownMessage('#current', '2026-10-22T10:00:05.000Z');

    handle(':ergo.test MARKREAD #current timestamp=2026-10-22T10:00:01.000Z');

    expect(mocks.setUnreadMessages).not.toHaveBeenCalled();
    expect(mocks.ircSendRawMessage).toHaveBeenCalledExactlyOnceWith('MARKREAD #current timestamp=2026-10-22T10:00:05.000Z');
  });

  it('accepts the timestamp as a trailing parameter', () => {
    mockEnvironment();

    handle(':ergo.test MARKREAD #chan :timestamp=2026-10-22T10:00:01.000Z');

    expect(getReadMarker('#chan')).toBe('2026-10-22T10:00:01.000Z');
  });

  it('leaves unread counts alone when nothing has been read yet', () => {
    const mocks = mockEnvironment([message('m', '2026-10-22T10:00:00.000Z')]);

    handle(':ergo.test MARKREAD #chan *');

    expect(getReadMarker('#chan')).toBeUndefined();
    expect(mocks.setUnreadMessages).not.toHaveBeenCalled();
  });

  it('ignores a marker for a window that is not open', () => {
    const mocks = mockEnvironment();

    handle(':ergo.test MARKREAD #unknown timestamp=2026-10-22T10:00:01.000Z');

    expect(mocks.setUnreadMessages).not.toHaveBeenCalled();
  });

  it.each([
    [':ergo.test MARKREAD #chan timestamp=garbage', 'timestamp'],
    [':ergo.test MARKREAD #chan 2026-10-22T10:00:01.000Z', 'timestamp'],
    [':ergo.test MARKREAD #chan', 'timestamp'],
    [':ergo.test MARKREAD', 'target'],
  ])('ignores a malformed marker: %s', (line, variable) => {
    const mocks = mockEnvironment([message('m', '2026-10-22T10:00:00.000Z')]);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    handle(line);

    expect(getReadMarker('#chan')).toBeUndefined();
    expect(mocks.setUnreadMessages).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(`Kernel error - cannot parse ${variable} at onMarkRead`, expect.anything());
  });
});
