/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL } from '@/config/config';
import { ChannelCategory } from '@shared/types';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel ircv3/typing', () => {
  setupKernelTest();

  it('test raw TAGMSG', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    const line =
      '@+draft/typing=active;+typing=active;account=kato_starszy;msgid=tsfqUigTlAhCbQYkVpty5s;time=2023-03-04T19:16:23.158Z :kato_starszy!~pirc@ukryty-FF796E25.net130.okay.pl TAGMSG #Religie';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);

    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('#Religie', 'kato_starszy', 'active');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw TAGMSG for private message uses sender nick as channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    const mockExistChannel = vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    // When Bob sends a typing notification in a private message, the IRC target is our nick
    const line = '@+draft/typing=active;+typing=active;msgid=abc123;time=2023-03-04T19:16:23.158Z :Bob!~bob@host TAGMSG MyNick';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();
    expect(mockExistChannel).toHaveBeenCalledWith('Bob');

    // The typing should be stored under Bob's nick (the sender), not MyNick (the target)
    // This matches how PRIVMSG stores messages in a PRIV window named after the sender
    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('Bob', 'Bob', 'active');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw TAGMSG for private message creates PRIV channel if not exists', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    const mockExistChannel = vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
    const mockSetAddChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    // When Bob sends a typing notification before any message, the PRIV channel doesn't exist yet
    const line = '@+draft/typing=active;+typing=active;msgid=abc123;time=2023-03-04T19:16:23.158Z :Bob!~bob@host TAGMSG MyNick';

    new Kernel({ type: 'raw', line }).handle();

    // Should create the PRIV channel
    expect(mockExistChannel).toHaveBeenCalledWith('Bob');
    expect(mockSetAddChannel).toHaveBeenCalledTimes(1);
    expect(mockSetAddChannel).toHaveBeenCalledWith('Bob', ChannelCategory.priv);

    // Then set typing
    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('Bob', 'Bob', 'active');
  });

  it('test raw TAGMSG for private message with real IRC message format', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true); // Channel already exists
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    // Real IRC message from the user's case
    const line = '@+draft/typing=active;+typing=active;account=M89;msgid=XBPeJPmEaLR2Ag9kJ6vqDi;time=2026-01-25T00:03:21.074Z :M89!~pirc@ukryty-AD0145A7.play-internet.pl TAGMSG Merovingian';

    new Kernel({ type: 'raw', line }).handle();

    // The typing should be stored under M89's nick (the sender)
    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('M89', 'M89', 'active');
  });

  it('test raw TAGMSG ignores our own echoed typing notification', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    // Our own typing TAGMSG echoed back by the server (echo-message)
    const line = '@+draft/typing=active;+typing=active;msgid=abc;time=2023-03-04T19:16:23.158Z :MyNick!~me@host TAGMSG #channel';

    new Kernel({ type: 'raw', line }).handle();

    // We must never show ourselves as typing
    expect(mockSetTyping).not.toHaveBeenCalled();
  });
});
