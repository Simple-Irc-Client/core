/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import { clearChannelWhoRequests, requestChannelWho } from '@/network/irc/kernel/core/who';
import { clearAllBatches } from '@/network/irc/batch';
import { clearLabels, createLabel, takeLabel } from '@/network/irc/labels';
import * as channelsFile from '@features/channels/store/channels';
import * as settingsFile from '@features/settings/store/settings';
import * as usersFile from '@features/users/store/users';
import * as networkFile from '@/network/irc/network';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

const handle = (line: string): void => {
  new Kernel({ type: 'raw', line }).handle();
};

describe('kernel ircv3/labeledresponse', () => {
  setupKernelTest();

  let mockSetAddMessage: MockInstance<typeof channelsFile.setAddMessage>;

  // Replies that reached a chat window, without the Debug echoes
  const shownReplies = (): unknown[] => mockSetAddMessage.mock.calls.map(([message]) => message).filter((message) => message.target !== DEBUG_CHANNEL);

  beforeEach(() => {
    clearLabels();
    clearAllBatches();
    clearChannelWhoRequests();
    mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockReturnValue('#now-viewing');
    vi.spyOn(settingsFile, 'getUserModes').mockReturnValue(defaultUserModes);
  });

  it('shows a single labeled reply in the window the command was sent from', () => {
    const label = createLabel({ window: '#sent-from' });

    handle(`@label=${label} :server 401 me bob :No such nick/channel`);

    expect(shownReplies()).toEqual([expect.objectContaining({ target: '#sent-from', message: expect.stringContaining('bob') })]);
  });

  it('consumes the label of a single reply', () => {
    const label = createLabel({ window: '#sent-from' });

    handle(`@label=${label} :server 401 me bob :No such nick/channel`);

    expect(takeLabel(label)).toBeUndefined();
  });

  it('shows every reply of a labeled batch as it arrives, numerics included', () => {
    const label = createLabel({ window: '#sent-from' });

    handle(`@label=${label} :server BATCH +whois1 labeled-response`);
    handle('@batch=whois1 :server 310 me bob :is available for help');
    expect(shownReplies()).toHaveLength(1);

    handle('@batch=whois1 :server 723 me kill :Insufficient oper privileges.');
    handle(':server BATCH -whois1');

    expect(shownReplies()).toEqual([
      expect.objectContaining({ target: '#sent-from', message: '* bob is available for help' }),
      expect.objectContaining({ target: '#sent-from', message: 'kill: Insufficient oper privileges.' }),
    ]);
  });

  it('consumes the label when the batch starts', () => {
    const label = createLabel({ window: '#sent-from' });

    handle(`@label=${label} :server BATCH +b1 labeled-response`);

    expect(takeLabel(label)).toBeUndefined();
  });

  it('shows nothing for an ACK and consumes its label', () => {
    const label = createLabel({ window: '#sent-from' });

    handle(`@label=${label} :server ACK`);

    expect(shownReplies()).toEqual([]);
    expect(takeLabel(label)).toBeUndefined();
  });

  it('falls back to the current window for a label it does not know', () => {
    handle('@label=expired :server 401 me bob :No such nick/channel');

    expect(shownReplies()).toEqual([expect.objectContaining({ target: '#now-viewing' })]);
  });

  it('still buffers a chathistory batch nested in a labeled batch', () => {
    const label = createLabel({ window: '#sent-from' });
    const mockSetAddChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});

    handle(`@label=${label} :server BATCH +outer labeled-response`);
    handle('@batch=outer :server BATCH +history chathistory #chan');
    handle('@batch=history;time=2026-01-01T00:00:00.000Z :alice!a@host PRIVMSG #chan :old message');

    expect(shownReplies()).toEqual([]);

    handle('@batch=outer :server BATCH -history');
    handle(':server BATCH -outer');

    expect(shownReplies()).toEqual([expect.objectContaining({ target: '#chan', message: 'old message' })]);
    mockSetAddChannel.mockRestore();
  });

  describe('WHO sent after joining', () => {
    beforeEach(() => {
      vi.spyOn(settingsFile, 'isSupportedOption').mockReturnValue(false);
      vi.spyOn(usersFile, 'getHasUser').mockReturnValue(false);
    });

    it('updates users from its labeled replies without showing them', () => {
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserRealname').mockImplementation(() => {});
      const label = createLabel({ automatic: true });

      handle(`@label=${label} :server BATCH +who1 labeled-response`);
      handle('@batch=who1 :server 352 me #chan ~alice host.example server alice H :0 Alice');
      handle('@batch=who1 :server 315 me #chan :End of WHO list');
      handle(':server BATCH -who1');

      expect(mockSetAddUser).toHaveBeenCalledWith(expect.objectContaining({ nick: 'alice' }));
      expect(shownReplies()).toEqual([]);
    });

    it('shows a WHO the user typed for the same channel while ours is pending', () => {
      vi.spyOn(networkFile, 'ircSendCommand').mockImplementation(() => false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      // Unlabeled WHO on join, tracked by channel name
      requestChannelWho('#chan');
      const label = createLabel({ window: '#sent-from' });

      handle(`@label=${label} :server BATCH +who2 labeled-response`);
      handle('@batch=who2 :server 352 me #chan ~alice host.example server alice H :0 Alice');
      handle('@batch=who2 :server 315 me #chan :End of WHO list');
      handle(':server BATCH -who2');

      expect(mockSetAddUser).not.toHaveBeenCalled();
      expect(shownReplies()).toEqual([
        expect.objectContaining({ target: '#sent-from', message: '#chan ~alice host.example server alice H: 0 Alice' }),
        expect.objectContaining({ target: '#sent-from', message: '#chan: End of WHO list' }),
      ]);
    });

    it('shows a labeled WHOX the user typed even with our query type', () => {
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const label = createLabel({ window: '#sent-from' });

      handle(`@label=${label} :server 354 me 152 #chan ~u host server alice H 0 :Alice`);

      expect(mockSetAddUser).not.toHaveBeenCalled();
      expect(shownReplies()).toEqual([expect.objectContaining({ target: '#sent-from' })]);
    });
  });
});
