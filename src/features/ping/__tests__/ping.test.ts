/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as channelsFile from '@features/channels/store/channels';
import { forgetPing, getPingWindow, showPingReply, trackPing } from '../ping';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ping', () => {
  it('knows the window a tracked ping was asked from', () => {
    trackPing('1000', '#chan');

    expect(getPingWindow('1000')).toBe('#chan');
  });

  it('knows no window for a token it never sent', () => {
    expect(getPingWindow('999999')).toBeUndefined();
  });

  it('forgets a ping once told to', () => {
    trackPing('2000', '#chan');

    forgetPing('2000');

    expect(getPingWindow('2000')).toBeUndefined();
  });

  it('keeps only the most recent pings', () => {
    trackPing('3000', '#oldest');
    for (let token = 3001; token <= 3050; token++) {
      trackPing(String(token), '#chan');
    }

    expect(getPingWindow('3000')).toBeUndefined();
    expect(getPingWindow('3050')).toBe('#chan');
  });

  it('shows the round trip in the window the ping was asked from', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(Date, 'now').mockReturnValue(4042);

    showPingReply('irc.example', '4000', '#chan');

    expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#chan', message: 'Odpowiedź na ping od irc.example: 42 ms' }));
  });

  it('never shows a negative round trip after the clock went back', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(Date, 'now').mockReturnValue(5000);

    showPingReply('irc.example', '5100', '#chan');

    expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ message: 'Odpowiedź na ping od irc.example: 0 ms' }));
  });
});
