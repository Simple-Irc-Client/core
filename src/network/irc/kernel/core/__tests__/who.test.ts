/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/who', () => {
  setupKernelTest();

  it('test raw 354 - WHOX reply', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getHasUser').mockReturnValue(false);
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockReturnValue(defaultUserModes);

    const line = ':insomnia.pirc.pl 354 mero 152 #Religie ~pirc ukryty-88E7A1BA.adsl.inetia.pl * JAKNEK Hs 0 :Użytkownik bramki';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddUser).toHaveBeenCalledWith(expect.objectContaining({ nick: 'JAKNEK' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 315 - end of WHO is not shown', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':ergo.test 315 probe1 #probe :End of WHO list';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
  });
});
