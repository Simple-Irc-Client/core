import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { showOwnCommandMessages } from '@features/chat/ownMessages';
import * as channelsFile from '@features/channels/store/channels';
import * as dmPresenceFile from '@features/dmPresence/dmPresence';
import * as networksStore from '@features/networks/store/networks';
import { ChannelCategory, MessageCategory } from '@shared/types';

describe('showOwnCommandMessages', () => {
  const openWindows = new Set(['#here', '#test']);
  let addMessage: MockInstance<typeof channelsFile.setAddMessage>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(networksStore, 'getCurrentNick').mockReturnValue('me');
    vi.spyOn(channelsFile, 'existChannel').mockImplementation((name) => openWindows.has(name));
    vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
    vi.spyOn(dmPresenceFile, 'subscribeDmPresence').mockImplementation(() => {});
    addMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
  });

  const shown = (): { message: string; target: string; category: MessageCategory }[] =>
    addMessage.mock.calls.map(([{ message, target, category }]) => ({ message, target, category }));

  it('shows an action in its channel', () => {
    showOwnCommandMessages('PRIVMSG #here :\x01ACTION waves\x01', '#test');

    expect(shown()).toEqual([{ message: 'waves', target: '#here', category: MessageCategory.me }]);
  });

  it('opens a private window for a message to a nick', () => {
    showOwnCommandMessages('PRIVMSG friend :hello', '#test');

    expect(channelsFile.setAddChannel).toHaveBeenCalledWith('friend', ChannelCategory.priv);
    expect(dmPresenceFile.subscribeDmPresence).toHaveBeenCalledWith('friend');
    expect(shown()).toEqual([{ message: 'hello', target: 'friend', category: MessageCategory.default }]);
  });

  it('shows a notice to a nick in the current window', () => {
    showOwnCommandMessages('NOTICE friend :heads up', '#test');

    expect(channelsFile.setAddChannel).not.toHaveBeenCalled();
    expect(shown()).toEqual([{ message: 'heads up', target: '#test', category: MessageCategory.notice }]);
  });

  it('shows every line of a command sent to several channels', () => {
    showOwnCommandMessages('PRIVMSG #here :hi all\nPRIVMSG #test :hi all', '#test');

    expect(shown().map(({ target }) => target)).toEqual(['#here', '#test']);
  });

  it('never shows what was sent to services', () => {
    showOwnCommandMessages('PRIVMSG NickServ :IDENTIFY secret', '#test');

    expect(addMessage).not.toHaveBeenCalled();
    expect(channelsFile.setAddChannel).not.toHaveBeenCalled();
  });

  it('ignores CTCP requests and lines that are not messages', () => {
    showOwnCommandMessages('PRIVMSG friend :\x01VERSION\x01\nTOPIC #here :new\nMODE #here +o friend', '#test');

    expect(addMessage).not.toHaveBeenCalled();
  });
});
