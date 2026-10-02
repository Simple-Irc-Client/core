/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageCategory } from '@shared/types';
import { MessageColor } from '@/config/theme';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel unhandled', () => {
  setupKernelTest();

  describe('unhandled numerics', () => {
    it('shows an unhandled error numeric in the current window', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

      const line = ':server 438 mynick newnick :Nick change too fast. Please wait 30 seconds.';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          target: '#current-channel',
          message: 'newnick: Nick change too fast. Please wait 30 seconds.',
          category: MessageCategory.error,
          color: MessageColor.error,
        }),
      );
      expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
    });

    it('treats documented error numerics outside 400-599 as errors', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

      const line = ':server 723 mynick kill :Insufficient oper privileges.';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ target: '#current-channel', message: 'kill: Insufficient oper privileges.', category: MessageCategory.error }),
      );
    });

    it('shows an unhandled informational numeric in Status', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = ':server 302 mynick :alice=+alice@host.example';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ target: STATUS_CHANNEL, message: 'alice=+alice@host.example', category: MessageCategory.info }),
      );
    });

    it('shows parameters when there is no trailing text', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = ':server 008 mynick +cFkn';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '+cFkn' }));
    });

    it('shows nothing for a numeric with no content', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server 999 mynick' }).handle();
      new Kernel({ type: 'raw', line: ':server 999' }).handle();
      new Kernel({ type: 'raw', line: ':server 999 mynick :' }).handle();

      // Debug echoes only
      expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
    });

    it('does not treat non-numeric commands as numerics', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server FOOBAR mynick :text' }).handle();
      new Kernel({ type: 'raw', line: ':server 4321 mynick :text' }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
    });
  });
});
