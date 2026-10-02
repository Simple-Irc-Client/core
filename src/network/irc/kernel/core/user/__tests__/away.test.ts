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
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/user/away', () => {
  setupKernelTest();

  it('test raw AWAY #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = '@account=wariatnakaftan;msgid=THDuCqdstQzWng1N5ALKi4;time=2023-03-23T17:04:33.953Z :wariatnakaftan!uid502816@vhost:far.away AWAY';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw AWAY #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = '@account=wariatnakaftan;msgid=k9mhVRzgAdqLBnnr2YboOh;time=2023-03-23T17:14:37.516Z :wariatnakaftan!uid502816@vhost:far.away AWAY :Auto-away';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 301', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 301 sic-test Noop :gone';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* Noop jest nieobecny (gone)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 305 - no longer away', () => {
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockSetCurrentUserFlag = vi.spyOn(settingsFile, 'setCurrentUserFlag').mockImplementation(() => {});
    const mockSetUserAway = vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 305 mero-test :You are no longer marked as being away';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetCurrentUserFlag).toHaveBeenCalledWith('away', false);
    expect(mockSetUserAway).toHaveBeenCalledWith('mero-test', false);

    expect(mockSetAddMessageToAllChannels).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: i18next.t("kernel.305.you-are-no-longer-marked-as-being-away") }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw 306 - now away', () => {
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockSetCurrentUserFlag = vi.spyOn(settingsFile, 'setCurrentUserFlag').mockImplementation(() => {});
    const mockSetUserAway = vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});

    const line = ':bzyk.pirc.pl 306 mero-test :You have been marked as being away';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetCurrentUserFlag).toHaveBeenCalledWith('away', true);
    expect(mockSetUserAway).toHaveBeenCalledWith('mero-test', true);

    expect(mockSetAddMessageToAllChannels).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: i18next.t('kernel.306.you-have-been-marked-as-being-away') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });
});
