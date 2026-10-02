/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/user/nick', () => {
  setupKernelTest();

  it('test raw NICK #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    const mockGetUserChannels = vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1', '#channel2']);

    const line = '@msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :Merovingian NICK :Niezident36707';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetUserChannels).toHaveBeenCalledTimes(1);
    expect(mockGetUserChannels).toHaveBeenCalledWith('Merovingian');

    expect(mockSetRenameUser).toHaveBeenCalledTimes(1);
    expect(mockSetRenameUser).toHaveBeenCalledWith('Merovingian', 'Niezident36707');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'Merovingian zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#channel2', message: 'Merovingian zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw NICK #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    const mockSetNick = vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {});
    const mockGetUserChannels = vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1', '#channel2']);

    const line = '@msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :SIC-test NICK :Niezident36707';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetUserChannels).toHaveBeenCalledTimes(1);
    expect(mockGetUserChannels).toHaveBeenNthCalledWith(1, 'SIC-test');

    expect(mockSetRenameUser).toHaveBeenCalledTimes(1);
    expect(mockSetRenameUser).toHaveBeenNthCalledWith(1, 'SIC-test', 'Niezident36707');

    expect(mockSetNick).toHaveBeenCalledTimes(1);
    expect(mockSetNick).toHaveBeenCalledWith('Niezident36707');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'SIC-test zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#channel2', message: 'SIC-test zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw NICK with full nick!ident@host sender parses nick correctly', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    const mockGetUserChannels = vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1']);
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = '@msgid=abc123;time=2023-02-12T14:20:53.072Z :OldNick!~user@some.host.com NICK :NewNick';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserChannels).toHaveBeenCalledWith('OldNick');
    expect(mockSetRenameUser).toHaveBeenCalledWith('OldNick', 'NewNick');
    // Channel message should use parsed nick, not full sender prefix
    expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel1', message: expect.stringContaining('OldNick') }));
    expect(mockSetAddMessage).not.toHaveBeenCalledWith(expect.objectContaining({ target: '#channel1', message: expect.stringContaining('~user@') }));
  });

  it('test raw NICK with full sender detects own nick change', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#test');
    vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#test']);
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetNick = vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {});

    const line = ':MyNick!~user@my.host NICK :MyNewNick';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetNick).toHaveBeenCalledWith('MyNewNick');
  });

  it('test raw NICK rejects nick exceeding max length', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1']);

    const longNick = 'A'.repeat(51);
    const line = `:Merovingian NICK :${longNick}`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetRenameUser).not.toHaveBeenCalled();
  });

  it('test raw NICK rejects nick with invalid characters', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1']);

    const line = ':Merovingian NICK :evil<script>nick';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetRenameUser).not.toHaveBeenCalled();
  });

  it('test raw NICK accepts valid nick with special chars', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1']);

    const line = ':Merovingian NICK :New_Nick[test]';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetRenameUser).toHaveBeenCalledWith('Merovingian', 'New_Nick[test]');
  });

  it('test raw 432 #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);

    const line = `:irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'ioiijhjkkljkljlkj :Erroneous Nickname' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 432 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);

    const line = `:irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'ioiijhjkkljkljlkj :Erroneous Nickname' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 432 #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);

    const line = `:insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'Merovingian :Nickname is unavailable: Being held for registered user' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 433 - nickname in use', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getIsWizardCompleted').mockReturnValue(true);

    const line = ':server.irc.net 433 * desirednick :Nickname is already in use';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('desirednick') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 447 - cannot change nick', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':insomnia.pirc.pl 447 sic-test :Can not change nickname while on #Religie (+N)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('#Religie') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });
});
