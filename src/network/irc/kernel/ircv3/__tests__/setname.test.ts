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

describe('kernel: SETNAME and ACCOUNT', () => {
  setupKernelTest();

  const handle = (line: string, channels: string[] = ['#one', '#two']) => {
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => channels);
    const setUserRealname = vi.spyOn(usersFile, 'setUserRealname').mockImplementation(() => {});
    const setUserAccount = vi.spyOn(usersFile, 'setUserAccount').mockImplementation(() => {});
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    new Kernel({ type: 'raw', line }).handle();

    const shown = setAddMessage.mock.calls.map(([message]) => message).filter((message) => message.target !== DEBUG_CHANNEL);
    return { setUserRealname, setUserAccount, shown };
  };

  it('should take a new real name and say so in every channel shared with them', () => {
    const { setUserRealname, shown } = handle(':alice!~a@host SETNAME :Alice Liddell');

    expect(setUserRealname).toHaveBeenCalledWith('alice', 'Alice Liddell');
    expect(shown.map(({ target }) => target)).toEqual(['#one', '#two']);
    expect(shown[0]?.message).toContain('Alice Liddell');
  });

  it('should show nothing for someone in no shared channel', () => {
    const { setUserRealname, shown } = handle(':alice!~a@host SETNAME :Alice Liddell', []);

    expect(setUserRealname).toHaveBeenCalledWith('alice', 'Alice Liddell');
    expect(shown).toEqual([]);
  });

  it('should ignore a SETNAME without a name', () => {
    const { setUserRealname, shown } = handle(':alice!~a@host SETNAME :');

    expect(setUserRealname).not.toHaveBeenCalled();
    expect(shown).toEqual([]);
  });

  it('should take the account someone logged in to', () => {
    const { setUserAccount } = handle(':alice!~a@host ACCOUNT alice_acct');

    expect(setUserAccount).toHaveBeenCalledWith('alice', 'alice_acct');
  });

  it.each([
    ['logged out', ':alice!~a@host ACCOUNT *'],
    ['no account given', ':alice!~a@host ACCOUNT'],
  ])('should clear the account when %s', (_case, line) => {
    const { setUserAccount } = handle(line);

    expect(setUserAccount).toHaveBeenCalledWith('alice', null);
  });
});
