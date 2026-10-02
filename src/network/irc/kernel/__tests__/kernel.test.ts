/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel index', () => {
  setupKernelTest();

  describe('credential redaction in debug channel', () => {
    it('should redact AUTHENTICATE payloads in debug log', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = 'AUTHENTICATE dXNlcm5hbWUAcGFzc3dvcmQ=';
      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ target: DEBUG_CHANNEL, message: '>> AUTHENTICATE ***' }),
      );
    });

    it('should redact AUTHENTICATE + (server challenge) in debug log', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = 'AUTHENTICATE +';
      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ target: DEBUG_CHANNEL, message: '>> AUTHENTICATE ***' }),
      );
    });

    it('should redact PASS commands in debug log', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = 'PASS mysecretpassword';
      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ target: DEBUG_CHANNEL, message: '>> PASS ***' }),
      );
    });

    it('should redact NickServ IDENTIFY in debug log', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = ':myuser!user@host PRIVMSG NickServ :IDENTIFY mypassword';
      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          target: DEBUG_CHANNEL,
          message: '>> :myuser!user@host PRIVMSG NickServ :IDENTIFY ***',
        }),
      );
    });

    it('should redact NickServ IDENTIFY with account and password in debug log', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = ':myuser!user@host PRIVMSG NickServ :IDENTIFY myaccount mypassword';
      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          target: DEBUG_CHANNEL,
          message: '>> :myuser!user@host PRIVMSG NickServ :IDENTIFY ***',
        }),
      );
    });

    it('should not redact normal PRIVMSG in debug log', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = ':user!user@host PRIVMSG #channel :hello world';
      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }),
      );
    });
  });
});
