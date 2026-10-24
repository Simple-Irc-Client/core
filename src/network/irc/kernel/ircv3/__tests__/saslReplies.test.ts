/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import * as capFile from '@/network/irc/kernel/ircv3/cap';
import * as networkFile from '@/network/irc/network';
import * as saslFile from '@/network/irc/sasl';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { MessageCategory } from '@shared/types';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel: SASL', () => {
  setupKernelTest();

  const handle = (line: string, { inProgress = true, responses = ['YWxpY2UAYWxpY2UAc2VjcmV0'] as string[] | null } = {}) => {
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const finish = vi.spyOn(capFile, 'finishCapNegotiation').mockImplementation(() => {});
    const send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const setState = vi.spyOn(saslFile, 'setSaslState').mockImplementation(() => {});
    const setAccount = vi.spyOn(saslFile, 'setAuthenticatedAccount').mockImplementation(() => {});
    const save = vi.spyOn(saslFile, 'saveSaslCredentialsForReconnect').mockResolvedValue();
    vi.spyOn(saslFile, 'isSaslInProgress').mockImplementation(() => inProgress);
    vi.spyOn(saslFile, 'handleSaslChallenge').mockImplementation(() => responses);

    new Kernel({ type: 'raw', line }).handle();

    const shown = setAddMessage.mock.calls.map(([message]) => message).filter((message) => message.target !== DEBUG_CHANNEL)
      .map(({ target, category }) => ({ target, category }));
    return { shown, finish, sent: send.mock.calls.map(([sentLine]) => sentLine), setState, setAccount, save };
  };

  describe('AUTHENTICATE', () => {
    it('should answer the server with the credentials', () => {
      const { sent, setState, finish } = handle('AUTHENTICATE +');

      expect(setState).toHaveBeenCalledWith('authenticating');
      expect(sent).toEqual(['AUTHENTICATE YWxpY2UAYWxpY2UAc2VjcmV0']);
      expect(finish).not.toHaveBeenCalled();
    });

    it('should send every chunk of a long answer', () => {
      const { sent } = handle('AUTHENTICATE +', { responses: ['A'.repeat(400), 'B'] });

      expect(sent).toEqual([`AUTHENTICATE ${'A'.repeat(400)}`, 'AUTHENTICATE B']);
    });

    it('should abort, and finish registering, without credentials to give', () => {
      const { sent, setState, finish } = handle('AUTHENTICATE +', { responses: null });

      expect(sent).toEqual(['AUTHENTICATE *']);
      expect(setState).toHaveBeenLastCalledWith('failed');
      expect(finish).toHaveBeenCalledOnce();
    });

    it('should ignore a challenge when no login is under way', () => {
      const { sent, setState } = handle('AUTHENTICATE +', { inProgress: false });

      expect(sent).toEqual([]);
      expect(setState).not.toHaveBeenCalled();
    });
  });

  it('should note the account logged in to, in Status', () => {
    const { setAccount, shown } = handle(':server 900 me me!~me@host alice :You are now logged in as alice');

    expect(setAccount).toHaveBeenCalledWith('alice');
    expect(shown).toEqual([{ target: STATUS_CHANNEL, category: MessageCategory.info }]);
  });

  it('should forget the account on logging out', () => {
    const { setAccount, shown } = handle(':server 901 me me!~me@host :You are now logged out');

    expect(setAccount).toHaveBeenCalledWith(null);
    expect(shown).toEqual([{ target: STATUS_CHANNEL, category: MessageCategory.info }]);
  });

  it('should keep the credentials for reconnecting once logged in, and finish registering', () => {
    const { save, setState, finish, shown } = handle(':server 903 me :SASL authentication successful');

    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(setState.mock.invocationCallOrder[0] ?? 0);
    expect(setState).toHaveBeenCalledWith('success');
    expect(finish).toHaveBeenCalledOnce();
    expect(shown).toEqual([{ target: STATUS_CHANNEL, category: MessageCategory.info }]);
  });

  it.each([
    ['902 nick locked', ':server 902 me :You must use a nick assigned to you', MessageCategory.error],
    ['904 failed', ':server 904 me :SASL authentication failed', MessageCategory.error],
    ['905 too long', ':server 905 me :SASL message too long', MessageCategory.error],
    ['906 aborted', ':server 906 me :SASL authentication aborted', MessageCategory.info],
  ])('should give up the login on %s, say so in Status, and finish registering', (_case, line, category) => {
    const { setState, finish, shown, save } = handle(line);

    expect(setState).toHaveBeenCalledWith('failed');
    expect(finish).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    expect(shown).toEqual([{ target: STATUS_CHANNEL, category }]);
  });

  it('should take an earlier login as done, silently', () => {
    const { setState, finish, shown } = handle(':server 907 me :You have already authenticated using SASL');

    expect(setState).toHaveBeenCalledWith('success');
    expect(finish).toHaveBeenCalledOnce();
    expect(shown).toEqual([]);
  });
});
