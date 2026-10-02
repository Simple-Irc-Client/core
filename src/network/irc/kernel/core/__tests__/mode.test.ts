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

describe('kernel core/mode', () => {
  setupKernelTest();

  it('test raw MODE user #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);
    const mockSetUpdateUserFlag = vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {});

    const line = ':mero MODE mero :+xz';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockSetUpdateUserFlag).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'mero ma teraz flage +x' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: STATUS_CHANNEL, message: 'mero ma teraz flage +z' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw MODE user +i (invisible)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':Merovingian!~Merovingi@45.142.162.33 MODE Merovingian +i';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Merovingian ma teraz flage +i' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw MODE user +iw (invisible and wallops)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = '@time=2026-01-24T21:57:51.724Z :Merovingian MODE Merovingian :+iw';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Merovingian ma teraz flage +i' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Merovingian ma teraz flage +w' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw MODE user +o (operator)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server MODE Merovingian +o';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Merovingian ma teraz flage +o' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw MODE user +s (server notices)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':Merovingian MODE Merovingian +s';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Merovingian ma teraz flage +s' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw MODE channel user #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => true);
    const mockSetUpdateUserFlag = vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = '@draft/bot;msgid=zAfMgqBIJHiIfUCpDbbUfm;time=2023-03-27T23:49:47.290Z :ChanServ!ChanServ@serwisy.pirc.pl MODE #sic +qo Merovingian Merovingian';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockSetUpdateUserFlag).toHaveBeenCalledTimes(2);
    expect(mockSetUpdateUserFlag).toHaveBeenNthCalledWith(1, 'Merovingian', '#sic', '+', 'q', defaultUserModes);
    expect(mockSetUpdateUserFlag).toHaveBeenNthCalledWith(2, 'Merovingian', '#sic', '+', 'o', defaultUserModes);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'Merovingian ma teraz flage +q (ustawił ChanServ)' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#sic', message: 'Merovingian ma teraz flage +o (ustawił ChanServ)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw MODE channel complex with multiple mode types', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => true);
    const mockSetUpdateUserFlag = vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    // CHANMODES from PIRC.pl: beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ
    const mockGetChannelModes = vi.spyOn(settingsFile, 'getChannelModes').mockImplementation(() => ({
      A: ['b', 'e', 'I'],
      B: ['f', 'k', 'L'],
      C: ['l', 'H'],
      D: ['c', 'd', 'i', 'm', 'n', 'p', 'r', 's', 't', 'z', 'B', 'C', 'D', 'G', 'K', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'V', 'Z'],
    }));

    // Complex MODE line: +rBCfHl-o with params for f, H, l, and o
    const line = '@draft/bot;bot;msgid=gdT3UNkBQco30FbIJuhORn;time=2026-01-15T19:58:12.349Z :ChanServ!ChanServ@serwisy.pirc.pl MODE #sic +rBCfHl-o [4j#R3,4k#K3,6m#M1,3n#N3,6t]:6 15:9999m 99 zsfsesefesfesfefs';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetChannelModes).toHaveBeenCalled();
    expect(mockGetUserModes).toHaveBeenCalled();
    expect(mockIsChannel).toHaveBeenCalled();

    // The -o mode should update the user 'zsfsesefesfesfefs', not anyone else
    expect(mockSetUpdateUserFlag).toHaveBeenCalledTimes(1);
    expect(mockSetUpdateUserFlag).toHaveBeenCalledWith('zsfsesefesfesfefs', '#sic', '-', 'o', defaultUserModes);

    // Check that the message for -o mentions the correct user
    expect(mockSetAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        target: '#sic',
        message: expect.stringContaining('zsfsesefesfesfefs'),
      })
    );
  });

  it('test raw 329 - channel created', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 329 sic-test #sic 1676587044';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 482 - not channel operator', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 482 sic-test #somechannel :You\'re not channel operator';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#somechannel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });
});
