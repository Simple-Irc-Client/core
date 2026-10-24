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

describe('kernel: CHGHOST', () => {
  setupKernelTest();

  const chghost = (line: string) => {
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#one', '#two']);
    const setUserHost = vi.spyOn(usersFile, 'setUserHost').mockImplementation(() => {});
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    new Kernel({ type: 'raw', line }).handle();

    return { setUserHost, targets: setAddMessage.mock.calls.map(([message]) => message.target).filter((target) => target !== DEBUG_CHANNEL) };
  };

  it('should show our own host change once, in Status', () => {
    const { setUserHost, targets } = chghost(':mynick!~me@old.host CHGHOST ~me cloak:MyNick');

    expect(targets).toEqual([STATUS_CHANNEL]);
    expect(setUserHost).toHaveBeenCalledWith('mynick', '~me', 'cloak:MyNick');
  });

  it('should show someone else\'s host change in the channels shared with them', () => {
    const { targets } = chghost(':alice!~a@old.host CHGHOST ~a new.host');

    expect(targets).toEqual(['#one', '#two']);
  });

  it('should ignore a CHGHOST without a new host', () => {
    const { setUserHost, targets } = chghost(':alice!~a@old.host CHGHOST ~a');

    expect(targets).toEqual([]);
    expect(setUserHost).not.toHaveBeenCalled();
  });
});
