/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';
import * as settingsFile from '@features/settings/store/settings';
import { trackPing } from '@features/ping/ping';

describe('kernel core/user/ping', () => {
  setupKernelTest();

  it('test raw PING', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = 'PING :F549DB3';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw PONG', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = '@msgid=MIikH9lopbKqOQpz8ADjfP;time=2023-03-20T23:07:21.701Z :chmurka.pirc.pl PONG chmurka.pirc.pl :1679353641686';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  describe('answers to /ping', () => {
    const PING_SENT_AT = 1767225600000;

    const pingAsked = (token: number, window: string) => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockReturnValue('me');
      vi.spyOn(Date, 'now').mockReturnValue(token + 42);
      trackPing(String(token), window);
      return mockSetAddMessage;
    };

    it('shows the server\'s round trip in the window /ping was typed in', () => {
      const mockSetAddMessage = pingAsked(PING_SENT_AT, '#chan');

      new Kernel({ type: 'raw', line: `:irc.example PONG irc.example :${PING_SENT_AT}` }).handle();

      expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ target: '#chan', message: 'Odpowiedź na ping od irc.example: 42 ms' }));
    });

    it('shows a server\'s answer only once', () => {
      const mockSetAddMessage = pingAsked(PING_SENT_AT + 1, '#chan');
      const line = `:irc.example PONG irc.example :${PING_SENT_AT + 1}`;

      new Kernel({ type: 'raw', line }).handle();
      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage.mock.calls.filter(([message]) => message.target === '#chan')).toHaveLength(1);
    });

    it('shows nothing for the keepalive\'s PONG', () => {
      const mockSetAddMessage = pingAsked(PING_SENT_AT + 2, '#chan');

      new Kernel({ type: 'raw', line: `:irc.example PONG irc.example :${PING_SENT_AT + 99}` }).handle();

      expect(mockSetAddMessage.mock.calls.filter(([message]) => message.target !== DEBUG_CHANNEL)).toHaveLength(0);
    });

    it('shows a user\'s round trip in the window /ping was typed in', () => {
      const mockSetAddMessage = pingAsked(PING_SENT_AT + 3, '#chan');

      new Kernel({ type: 'raw', line: `:alice!a@host NOTICE me :\x01PING ${PING_SENT_AT + 3}\x01` }).handle();

      expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ target: '#chan', message: 'Odpowiedź na ping od alice: 42 ms' }));
    });

    it('shows each user\'s answer to a ping sent to a channel', () => {
      const mockSetAddMessage = pingAsked(PING_SENT_AT + 4, '#chan');

      new Kernel({ type: 'raw', line: `:alice!a@host NOTICE me :\x01PING ${PING_SENT_AT + 4}\x01` }).handle();
      new Kernel({ type: 'raw', line: `:bob!b@host NOTICE me :\x01PING ${PING_SENT_AT + 4}\x01` }).handle();

      expect(mockSetAddMessage.mock.calls.filter(([message]) => message.target === '#chan')).toHaveLength(2);
    });

    it('shows a user\'s answer to a ping this client never sent as a plain CTCP reply', () => {
      const mockSetAddMessage = pingAsked(PING_SENT_AT + 5, '#chan');

      new Kernel({ type: 'raw', line: ':alice!a@host NOTICE me :\x01PING 123\x01' }).handle();

      expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ target: STATUS_CHANNEL, message: 'Odpowiedź CTCP PING od alice: 123' }));
    });
  });
});
