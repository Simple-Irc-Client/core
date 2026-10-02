/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel ircv3/metadata', () => {
  setupKernelTest();

  it('test raw METADATA', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop avatar * :https://www.gravatar.com/avatar/55a2daf22200bd0f31cdb6b720911a74.jpg';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Noop', 'https://www.gravatar.com/avatar/55a2daf22200bd0f31cdb6b720911a74.jpg');
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA replaces {size} in avatar URL', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Qbick avatar * :https://usercontent.irccloud-cdn.com/avatar/s{size}/FxI0nUto';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Qbick', 'https://usercontent.irccloud-cdn.com/avatar/s64/FxI0nUto');
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA rejects avatar with javascript: URL', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop avatar * :javascript:alert(1)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).not.toHaveBeenCalled();
  });

  it('test raw METADATA rejects avatar with data: URL', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop avatar * :data:image/svg+xml;base64,PHN2Zz4=';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).not.toHaveBeenCalled();
  });

  it('test raw METADATA rejects avatar with http: URL (mixed content, blocked by CSP)', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop avatar * :http://example.com/avatar.png';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).not.toHaveBeenCalled();
  });

  it('test raw METADATA rejects avatar on a private/internal host', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop avatar * :https://192.168.1.10/avatar.png';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).not.toHaveBeenCalled();
  });

  it('test raw METADATA rejects channel avatar with javascript: URL', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetChannelAvatar = vi.spyOn(channelsFile, 'setChannelAvatar').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => true);

    const line = ':netsplit.pirc.pl METADATA #test avatar * :javascript:alert(1)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelAvatar).not.toHaveBeenCalled();
  });

  it('test raw METADATA display-name for user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserDisplayName = vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop display-name * :John Doe';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserDisplayName).toHaveBeenCalledWith('Noop', 'John Doe');
    expect(mockSetUserDisplayName).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA display-name for channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetChannelDisplayName = vi.spyOn(channelsFile, 'setChannelDisplayName').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => true);

    const line = ':netsplit.pirc.pl METADATA #test display-name * :Test Channel';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetChannelDisplayName).toHaveBeenCalledWith('#test', 'Test Channel');
    expect(mockSetChannelDisplayName).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA display-name with spaces', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserDisplayName = vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop display-name * :John Michael Doe Jr.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserDisplayName).toHaveBeenCalledWith('Noop', 'John Michael Doe Jr.');
    expect(mockSetUserDisplayName).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA status for user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserStatus = vi.spyOn(usersFile, 'setUserStatus').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop status * :Working from home';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserStatus).toHaveBeenCalledWith('Noop', 'Working from home');
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA status with spaces', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserStatus = vi.spyOn(usersFile, 'setUserStatus').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop status * :On vacation until Monday';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserStatus).toHaveBeenCalledWith('Noop', 'On vacation until Monday');
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA status clears for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserStatus = vi.spyOn(usersFile, 'setUserStatus').mockImplementation(() => {});
    const mockSetCurrentUserStatus = vi.spyOn(settingsFile, 'setCurrentUserStatus').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser status * :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();

    expect(mockSetUserStatus).toHaveBeenCalledWith('TestUser', undefined);
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentUserStatus).toHaveBeenCalledWith(undefined);
    expect(mockSetCurrentUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA homepage for user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop homepage * :https://example.com';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserHomepage).toHaveBeenCalledWith('Noop', 'https://example.com');
    expect(mockSetUserHomepage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA homepage allows http: URL (navigation, not a sub-resource)', () => {
    // Unlike avatars, homepages open in an external browser, so http stays valid.
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop homepage * :http://example.com';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserHomepage).toHaveBeenCalledWith('Noop', 'http://example.com');
  });

  it('test raw METADATA homepage clears with empty value', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser homepage * :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserHomepage).toHaveBeenCalledWith('TestUser', undefined);
    expect(mockSetUserHomepage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA homepage saves for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    const mockSetCurrentUserHomepage = vi.spyOn(settingsFile, 'setCurrentUserHomepage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser homepage * :https://mywebsite.com';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();

    expect(mockSetUserHomepage).toHaveBeenCalledWith('TestUser', 'https://mywebsite.com');
    expect(mockSetUserHomepage).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentUserHomepage).toHaveBeenCalledWith('https://mywebsite.com');
    expect(mockSetCurrentUserHomepage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA rejects homepage with javascript: URL', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop homepage * :javascript:alert(document.cookie)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserHomepage).not.toHaveBeenCalled();
  });

  it('test raw METADATA rejects homepage with data: URL', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop homepage * :data:text/html,<script>alert(1)</script>';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserHomepage).not.toHaveBeenCalled();
  });

  it('test raw METADATA color for user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop color * :#ff5500';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserColor).toHaveBeenCalledWith('Noop', '#ff5500');
    expect(mockSetUserColor).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA color saves for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    const mockSetCurrentUserColor = vi.spyOn(settingsFile, 'setCurrentUserColor').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser color * :#00ff00';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();

    expect(mockSetUserColor).toHaveBeenCalledWith('TestUser', '#00ff00');
    expect(mockSetUserColor).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentUserColor).toHaveBeenCalledWith('#00ff00');
    expect(mockSetCurrentUserColor).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA color clears for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    const mockSetCurrentUserColor = vi.spyOn(settingsFile, 'setCurrentUserColor').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser color * :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();

    expect(mockSetUserColor).toHaveBeenCalledWith('TestUser', undefined);
    expect(mockSetUserColor).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentUserColor).toHaveBeenCalledWith(undefined);
    expect(mockSetCurrentUserColor).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA rejects color with CSS injection', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop color * :red; background: url(evil.com)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).not.toHaveBeenCalled();
  });

  it('test raw METADATA rejects color with expression injection', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop color * :expression(alert(1))';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).not.toHaveBeenCalled();
  });

  it('test raw METADATA rejects color with var() injection', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop color * :var(--secret)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).not.toHaveBeenCalled();
  });

  it('test raw METADATA accepts valid hex color', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop color * :#aabbcc';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).toHaveBeenCalledWith('Noop', '#aabbcc');
  });

  it('test raw METADATA accepts valid named color', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop color * :tomato';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).toHaveBeenCalledWith('Noop', 'tomato');
  });

  it('test raw METADATA accepts valid rgb color', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop color * :rgb(255, 128, 0)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).toHaveBeenCalledWith('Noop', 'rgb(255, 128, 0)');
  });

  // METADATA clearing tests — no trailing value means the key is being unset
  it('test raw METADATA clears avatar when no value (no trailing colon)', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    // Real-world format from logs: METADATA M89 avatar * (no trailing value at all)
    const line = ':M89!~pirc@host METADATA M89 avatar *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('M89', undefined);
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA clears avatar with empty trailing value', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA Noop avatar * :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Noop', undefined);
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA clears avatar for current user', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockSetCurrentUserAvatar = vi.spyOn(settingsFile, 'setCurrentUserAvatar').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA TestUser avatar *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('TestUser', undefined);
    expect(mockSetCurrentUserAvatar).toHaveBeenCalledWith(undefined);
  });

  it('test raw METADATA clears color when no value (no trailing colon)', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA Noop color *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).toHaveBeenCalledWith('Noop', undefined);
    expect(mockSetUserColor).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA clears color for current user when no value', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    const mockSetCurrentUserColor = vi.spyOn(settingsFile, 'setCurrentUserColor').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA TestUser color *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).toHaveBeenCalledWith('TestUser', undefined);
    expect(mockSetCurrentUserColor).toHaveBeenCalledWith(undefined);
  });

  it('test raw METADATA clears display-name when no value (no trailing colon)', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserDisplayName = vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA Noop display-name *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserDisplayName).toHaveBeenCalledWith('Noop', undefined);
    expect(mockSetUserDisplayName).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA clears display-name with empty trailing value', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserDisplayName = vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA Noop display-name * :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserDisplayName).toHaveBeenCalledWith('Noop', undefined);
    expect(mockSetUserDisplayName).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA clears display-name for current user', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserDisplayName = vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});
    const mockSetCurrentUserDisplayName = vi.spyOn(settingsFile, 'setCurrentUserDisplayName').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA TestUser display-name *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserDisplayName).toHaveBeenCalledWith('TestUser', undefined);
    expect(mockSetCurrentUserDisplayName).toHaveBeenCalledWith(undefined);
  });

  it('test raw METADATA clears status when no value (no trailing colon)', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserStatus = vi.spyOn(usersFile, 'setUserStatus').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA Noop status *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserStatus).toHaveBeenCalledWith('Noop', undefined);
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA clears homepage when no value (no trailing colon)', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server METADATA Noop homepage *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserHomepage).toHaveBeenCalledWith('Noop', undefined);
    expect(mockSetUserHomepage).toHaveBeenCalledTimes(1);
  });

  it('test raw 761', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Merovingian', 'https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg');
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 761 replaces {size} in avatar URL', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Qbick Avatar * :https://usercontent.irccloud-cdn.com/avatar/s{size}/FxI0nUto';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Qbick', 'https://usercontent.irccloud-cdn.com/avatar/s64/FxI0nUto');
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 762', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 762 SIC-test :end of metadata';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 766', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 766 SIC-test SIC-test Avatar :no matching key';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('SIC-test', undefined);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  // ergo notifies subscribers of a *deleted* key with 766, not with a valueless 761/METADATA
  it('test raw 766 clears display name', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserDisplayName = vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});

    const line = ':ergo.test 766 * Merovingian display-name :Key deleted';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserDisplayName).toHaveBeenCalledWith('Merovingian', undefined);
  });

  it('test raw 766 clears current user display name', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});
    const mockSetCurrentUserDisplayName = vi.spyOn(settingsFile, 'setCurrentUserDisplayName').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockReturnValue('TestUser');

    const line = ':ergo.test 766 * TestUser display-name :Key deleted';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetCurrentUserDisplayName).toHaveBeenCalledWith(undefined);
  });

  it('test raw 766 clears channel display name', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation((name) => name?.startsWith('#'));
    const mockSetChannelDisplayName = vi.spyOn(channelsFile, 'setChannelDisplayName').mockImplementation(() => {});

    const line = ':ergo.test 766 * #quizowagra display-name :Key deleted';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelDisplayName).toHaveBeenCalledWith('#quizowagra', '');
  });

  it('test raw 770 avatar', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':jowisz.pirc.pl 770 Merovingian :avatar';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-avatar');
    expect(mockSetSupportedOption).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 770 status', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':jowisz.pirc.pl 770 Merovingian :status';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-status');
    expect(mockSetSupportedOption).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 770 display-name', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':jowisz.pirc.pl 770 Merovingian :display-name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-display-name');
    expect(mockSetSupportedOption).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 770 with multiple keys (ergo format)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':ergo.test 770 * avatar status bot homepage display-name color';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-avatar');
    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-status');
    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-bot');
    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-homepage');
    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-display-name');
    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-color');
    expect(mockSetSupportedOption).toHaveBeenCalledTimes(6);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 761 sets currentUserAvatar for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockSetCurrentUserAvatar = vi.spyOn(settingsFile, 'setCurrentUserAvatar').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockReturnValue('TestUser');

    const line = ':insomnia.pirc.pl 761 TestUser TestUser Avatar * :https://example.com/avatar.png';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('TestUser', 'https://example.com/avatar.png');
    expect(mockSetCurrentUserAvatar).toHaveBeenCalledWith('https://example.com/avatar.png');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
  });

  it('test raw 761 does not set currentUserAvatar for other user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockSetCurrentUserAvatar = vi.spyOn(settingsFile, 'setCurrentUserAvatar').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockReturnValue('TestUser');

    const line = ':insomnia.pirc.pl 761 TestUser OtherUser Avatar * :https://example.com/avatar.png';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('OtherUser', 'https://example.com/avatar.png');
    expect(mockSetCurrentUserAvatar).not.toHaveBeenCalled();
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
  });

  it('test raw 761 rejects avatar with javascript: URL', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :javascript:alert(1)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).not.toHaveBeenCalled();
  });

  it('test raw 761 rejects avatar with data: URL', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :data:image/svg+xml;base64,PHN2Zz4=';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).not.toHaveBeenCalled();
  });

  it('test raw 761 rejects color with CSS injection', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Merovingian color * :red; background: url(evil.com)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).not.toHaveBeenCalled();
  });

  it('test raw 761 accepts valid hex color', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Merovingian color * :#ff5500';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).toHaveBeenCalledWith('Merovingian', '#ff5500');
  });

  it('test raw 761 rejects color with url() injection', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Merovingian color * :url(https://evil.com/track)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserColor).not.toHaveBeenCalled();
  });

  it('test raw 761 sets channel display-name', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation((name) => name?.startsWith('#'));
    const mockSetChannelDisplayName = vi.spyOn(channelsFile, 'setChannelDisplayName').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test #quizowagra display-name * :QuizowaGra';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelDisplayName).toHaveBeenCalledWith('#quizowagra', 'QuizowaGra');
  });

  it('test raw 761 sets channel avatar', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation((name) => name?.startsWith('#'));
    const mockSetChannelAvatar = vi.spyOn(channelsFile, 'setChannelAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test #test avatar * :https://example.com/channel-avatar.png';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelAvatar).toHaveBeenCalledWith('#test', 'https://example.com/channel-avatar.png');
  });

  it('test raw 761 rejects channel avatar with javascript: URL', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation((name) => name?.startsWith('#'));
    const mockSetChannelAvatar = vi.spyOn(channelsFile, 'setChannelAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test #test avatar * :javascript:alert(1)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelAvatar).not.toHaveBeenCalled();
  });

  it('test raw 761 clears channel display-name when value is empty', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'isChannel').mockImplementation((name) => name?.startsWith('#'));
    const mockSetChannelDisplayName = vi.spyOn(channelsFile, 'setChannelDisplayName').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test #test display-name *';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelDisplayName).toHaveBeenCalledWith('#test', '');
  });
});
