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

describe('kernel: a taken nick', () => {
  setupKernelTest();

  const handle = (line: string) => new Kernel({ type: 'raw', line }).handle();

  beforeEach(() => {
    useSettingsStore.setState({ nick: 'piotr', wantedNick: undefined, isConnected: false, isWizardCompleted: true, monitorLimit: 100 });
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(subscribeFile, 'subscribeNicks').mockImplementation(() => {});
    vi.spyOn(subscribeFile, 'unsubscribeNicks').mockImplementation(() => {});
  });

  it('should register under an alternative, wait for the wanted nick and take it once it is free', () => {
    const send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    handle(':ergo.test 433 * piotr :Nickname is already in use');
    expect(send).toHaveBeenLastCalledWith('NICK piotr_');
    expect(useSettingsStore.getState().wantedNick).toBe('piotr');

    handle(':ergo.test 001 piotr_ :Welcome');
    expect(useSettingsStore.getState()).toMatchObject({ nick: 'piotr_', wantedNick: 'piotr' });

    handle(':ergo.test 376 piotr_ :End of MOTD');
    expect(subscribeFile.subscribeNicks).toHaveBeenCalledWith(['piotr']);

    handle(':ergo.test 731 piotr_ :piotr');
    expect(send).toHaveBeenLastCalledWith('NICK piotr');

    handle(':piotr_!~p@host NICK piotr');
    expect(useSettingsStore.getState()).toMatchObject({ nick: 'piotr', wantedNick: undefined });
  });

  it('should register with the wanted nick on the next connection', () => {
    useSettingsStore.setState({ nick: 'piotr_', wantedNick: 'piotr' });

    handle(':ergo.test 001 piotr :Welcome');

    expect(useSettingsStore.getState()).toMatchObject({ nick: 'piotr', wantedNick: undefined });
  });

  it('should take the nick when WATCH reports it gone', () => {
    useSettingsStore.setState({ nick: 'piotr_', wantedNick: 'piotr', isConnected: true });
    const send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    handle(':server 601 piotr_ piotr ~p host 1700000000 :logged off');

    expect(send).toHaveBeenCalledWith('NICK piotr');
  });

  it('should report a taken nick, not try alternatives, once registered', () => {
    useSettingsStore.setState({ isConnected: true });
    const send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    handle(':ergo.test 433 piotr alice :Nickname is already in use');

    expect(send).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().wantedNick).toBeUndefined();
  });

  it('should stop waiting when the user picks a nick with /nick', () => {
    useSettingsStore.setState({ nick: 'piotr_', wantedNick: 'piotr', isConnected: true });

    expect(parseMessageToCommand('#home', '/nick other')).toBe('NICK other');
    expect(useSettingsStore.getState().wantedNick).toBeUndefined();
  });
});
