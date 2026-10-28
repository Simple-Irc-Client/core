/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as networkFile from '@/network/irc/network';
import * as channelsFile from '@features/channels/store/channels';
import * as subscribeFile from '@features/monitor/subscribe';
import { useSettingsStore } from '@features/settings/store/settings';
import { parseMessageToCommand } from '@/network/irc/command';
import { setupKernelTest } from './fixtures';
import { setTestSession } from '@/test/networks';
import { getActiveSession } from '@features/networks/store/networks';

describe('kernel: a taken nick', () => {
  setupKernelTest();

  const handle = (line: string) => new Kernel({ type: 'raw', line }).handle();

  beforeEach(() => {
    useSettingsStore.setState({ isWizardCompleted: true });
    setTestSession({ nick: 'piotr', wantedNick: undefined, isConnected: false, monitorLimit: 100 });
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(subscribeFile, 'subscribeNicks').mockImplementation(() => {});
    vi.spyOn(subscribeFile, 'unsubscribeNicks').mockImplementation(() => {});
  });

  it('should register under an alternative, wait for the wanted nick and take it once it is free', () => {
    const send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    handle(':ergo.test 433 * piotr :Nickname is already in use');
    expect(send).toHaveBeenLastCalledWith('NICK piotr_');
    expect(getActiveSession().wantedNick).toBe('piotr');

    handle(':ergo.test 001 piotr_ :Welcome');
    expect(getActiveSession()).toMatchObject({ nick: 'piotr_', wantedNick: 'piotr' });

    handle(':ergo.test 376 piotr_ :End of MOTD');
    expect(subscribeFile.subscribeNicks).toHaveBeenCalledWith(['piotr']);

    handle(':ergo.test 731 piotr_ :piotr');
    expect(send).toHaveBeenLastCalledWith('NICK piotr');

    handle(':piotr_!~p@host NICK piotr');
    expect(getActiveSession()).toMatchObject({ nick: 'piotr', wantedNick: undefined });
  });

  it('should register with the wanted nick on the next connection', () => {
    setTestSession({ nick: 'piotr_', wantedNick: 'piotr' });

    handle(':ergo.test 001 piotr :Welcome');

    expect(getActiveSession()).toMatchObject({ nick: 'piotr', wantedNick: undefined });
  });

  it('should take the nick when WATCH reports it gone', () => {
    setTestSession({ nick: 'piotr_', wantedNick: 'piotr', isConnected: true });
    const send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    handle(':server 601 piotr_ piotr ~p host 1700000000 :logged off');

    expect(send).toHaveBeenCalledWith('NICK piotr');
  });

  it('should report a taken nick, not try alternatives, once registered', () => {
    setTestSession({ isConnected: true });
    const send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    handle(':ergo.test 433 piotr alice :Nickname is already in use');

    expect(send).not.toHaveBeenCalled();
    expect(getActiveSession().wantedNick).toBeUndefined();
  });

  it('should stop waiting when the user picks a nick with /nick', () => {
    setTestSession({ nick: 'piotr_', wantedNick: 'piotr', isConnected: true });

    expect(parseMessageToCommand('#home', '/nick other')).toBe('NICK other');
    expect(getActiveSession().wantedNick).toBeUndefined();
  });
});
