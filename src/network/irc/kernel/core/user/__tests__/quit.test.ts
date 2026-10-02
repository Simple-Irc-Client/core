/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import i18next from '@/app/i18n';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/user/quit', () => {
  setupKernelTest();

  it('test raw QUIT', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetQuitUser = vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});

    const line = '@msgid=aGJTRBjAMOMRB6Ky2ucXbV-Gved4HyF6QNSHYfzOX1jOA;time=2023-03-11T00:52:21.568Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP QUIT :Quit: Leaving';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetQuitUser).toHaveBeenCalledTimes(1);
    expect(mockSetQuitUser).toHaveBeenCalledWith('mero', expect.objectContaining({ message: 'mero opuścił serwer (Quit: Leaving)' }));

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw QUIT includes nick in message for context menu', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetQuitUser = vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});
    const mockUser = { nick: 'mero', ident: '~mero', hostname: 'host', flags: [], channels: [] };
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => mockUser);

    const line = '@msgid=abc;time=2023-03-11T00:52:21.568Z :mero!~mero@host QUIT :Quit: Leaving';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetQuitUser).toHaveBeenCalledWith('mero', expect.objectContaining({ nick: mockUser }));
  });

  it('test i18n does not escape HTML entities in interpolated values', () => {
    // Test that URLs with special characters are not HTML-escaped
    // This verifies the fix for escapeValue: false in i18n config
    const url = 'https://thelounge.chat';
    const message = i18next.t('kernel.quit', { nick: 'user', reason: ` (Quit: ${url})` });

    // The URL should NOT be escaped to &#x2F;&#x2F;
    expect(message).toContain('https://thelounge.chat');
    expect(message).not.toContain('&#x2F;');
    expect(message).not.toContain('&#');
  });

  it('test i18n preserves special characters in quit messages', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#test']);
    vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});

    const line = ':testuser!~test@host.example QUIT :The Lounge - https://thelounge.chat';

    new Kernel({ type: 'raw', line }).handle();

    // Verify the message contains the actual URL, not HTML entities
    expect(mockSetAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('https://thelounge.chat'),
      }),
    );
    expect(mockSetAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.not.stringContaining('&#x2F;'),
      }),
    );
  });
});
