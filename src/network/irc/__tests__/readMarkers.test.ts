import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '../capabilities';
import * as networkFile from '../network';
import { clearReadMarkers, getReadMarker, markRead, markReadSoon, noteShownMessage, setReadMarker } from '../readMarkers';

describe('readMarkers', () => {
  let send: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearReadMarkers();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['draft/read-marker']);
    send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marks a window read up to the newest message shown in it', () => {
    noteShownMessage('#chan', '2026-10-22T10:00:02.000Z');
    noteShownMessage('#chan', '2026-10-22T10:00:01.000Z');

    markRead('#chan');

    expect(send).toHaveBeenCalledExactlyOnceWith('MARKREAD #chan timestamp=2026-10-22T10:00:02.000Z');
    expect(getReadMarker('#chan')).toBe('2026-10-22T10:00:02.000Z');
  });

  it('compares times, not their text, when they differ in precision', () => {
    noteShownMessage('#chan', '2026-10-22T10:00:02.500Z');
    noteShownMessage('#chan', '2026-10-22T10:00:02Z');

    markRead('#chan');

    expect(send).toHaveBeenCalledExactlyOnceWith('MARKREAD #chan timestamp=2026-10-22T10:00:02.500Z');
  });

  it('does not send the same marker twice', () => {
    noteShownMessage('#chan', '2026-10-22T10:00:00.000Z');

    markRead('#chan');
    markRead('#chan');

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not move the marker back behind what another client already read', () => {
    noteShownMessage('#chan', '2026-10-22T10:00:00.000Z');
    setReadMarker('#chan', '2026-10-22T11:00:00.000Z');

    markRead('#chan');

    expect(send).not.toHaveBeenCalled();
  });

  it('sends nothing for a window with no message from the server', () => {
    markRead('#empty');

    expect(send).not.toHaveBeenCalled();
  });

  it('sends nothing when the server does not support read markers', () => {
    resetCapabilityState();
    noteShownMessage('#chan', '2026-10-22T10:00:00.000Z');

    markRead('#chan');
    markReadSoon('#chan');

    expect(send).not.toHaveBeenCalled();
  });

  it('treats differently cased names as one window', () => {
    noteShownMessage('#Chan', '2026-10-22T10:00:00.000Z');
    setReadMarker('#CHAN', '2026-10-22T09:00:00.000Z');

    markRead('#chan');

    expect(send).toHaveBeenCalledExactlyOnceWith('MARKREAD #chan timestamp=2026-10-22T10:00:00.000Z');
  });

  describe('markReadSoon', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('sends one marker for a burst of messages, after a pause', () => {
      noteShownMessage('#chan', '2026-10-22T10:00:00.000Z');
      markReadSoon('#chan');
      noteShownMessage('#chan', '2026-10-22T10:00:01.000Z');
      markReadSoon('#chan');

      expect(send).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);

      expect(send).toHaveBeenCalledExactlyOnceWith('MARKREAD #chan timestamp=2026-10-22T10:00:01.000Z');
    });

    it('sends the pending marker when another window is marked read', () => {
      noteShownMessage('#first', '2026-10-22T10:00:00.000Z');
      noteShownMessage('#second', '2026-10-22T10:00:01.000Z');
      markReadSoon('#first');

      markRead('#second');

      expect(send).toHaveBeenNthCalledWith(1, 'MARKREAD #first timestamp=2026-10-22T10:00:00.000Z');
      expect(send).toHaveBeenNthCalledWith(2, 'MARKREAD #second timestamp=2026-10-22T10:00:01.000Z');
      vi.advanceTimersByTime(2000);
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('drops the pending marker when the connection goes away', () => {
      noteShownMessage('#chan', '2026-10-22T10:00:00.000Z');
      markReadSoon('#chan');

      clearReadMarkers();
      vi.advanceTimersByTime(2000);

      expect(send).not.toHaveBeenCalled();
      expect(getReadMarker('#chan')).toBeUndefined();
    });
  });
});
