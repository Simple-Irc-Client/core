import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as networkFile from '@/network/irc/network';
import * as subscribeFile from '@features/monitor/subscribe';
import * as friendsFile from '@features/friends/friends';
import * as channelsFile from '@features/channels/store/channels';
import { useSettingsStore } from '@features/settings/store/settings';
import { alternativeNick, forgetWantedNick, onNicksOffline, onOwnNickChanged, onRegisteredAs, reclaimWantedNick, registrationNick, rememberWantedNick, watchWantedNick } from '../nickRegain';

const state = (fields: Partial<ReturnType<typeof useSettingsStore.getState>>) => useSettingsStore.setState(fields);

describe('nick regain', () => {
  let send: ReturnType<typeof vi.spyOn>;
  let command: ReturnType<typeof vi.spyOn>;
  let subscribe: ReturnType<typeof vi.spyOn>;
  let unsubscribe: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    state({ nick: 'piotr_', wantedNick: 'piotr', isConnected: true, currentChannelName: '#home', monitorLimit: 100, watchLimit: 0 });
    send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    command = vi.spyOn(networkFile, 'ircSendCommand').mockImplementation(() => true);
    subscribe = vi.spyOn(subscribeFile, 'subscribeNicks').mockImplementation(() => {});
    unsubscribe = vi.spyOn(subscribeFile, 'unsubscribeNicks').mockImplementation(() => {});
    vi.spyOn(friendsFile, 'isFriend').mockReturnValue(false);
    vi.spyOn(channelsFile, 'getOpenDmNicks').mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('registering', () => {
    it('should register with the wanted nick when the last connection had to do without it', () => {
      expect(registrationNick()).toBe('piotr');

      state({ wantedNick: undefined });
      expect(registrationNick()).toBe('piotr_');
    });

    it('should try a taken nick with underscores', () => {
      state({ nick: 'piotr', wantedNick: undefined });
      expect(alternativeNick('piotr')).toBe('piotr_');

      state({ wantedNick: 'piotr' });
      expect(alternativeNick('piotr_')).toBe('piotr__');
      expect(alternativeNick('piotr__')).toBe('piotr___');
    });

    it('should give up after three underscores', () => {
      expect(alternativeNick('piotr___')).toBeUndefined();
    });

    it('should give up on a taken nick that is no alternative of the wanted one', () => {
      expect(alternativeNick('someone')).toBeUndefined();
    });

    it('should remember the first taken nick as the wanted one, and only that one', () => {
      state({ wantedNick: undefined });

      rememberWantedNick('piotr');
      rememberWantedNick('piotr_');

      expect(useSettingsStore.getState().wantedNick).toBe('piotr');
    });

    it('should only answer which nick to try, not remember anything', () => {
      state({ wantedNick: undefined });

      alternativeNick('piotr');

      expect(useSettingsStore.getState().wantedNick).toBeUndefined();
    });

    it('should end the wait when registered as the wanted nick, whatever its case', () => {
      onRegisteredAs('Piotr');

      expect(useSettingsStore.getState().wantedNick).toBeUndefined();
    });

    it('should keep waiting when registered as an alternative', () => {
      onRegisteredAs('piotr_');

      expect(useSettingsStore.getState().wantedNick).toBe('piotr');
    });
  });

  describe('waiting', () => {
    it('should watch the wanted nick once registered under another', () => {
      watchWantedNick();

      expect(subscribe).toHaveBeenCalledWith(['piotr']);
    });

    it.each([
      ['nothing is wanted', { wantedNick: undefined }],
      ['the wanted nick is ours already', { nick: 'piotr' }],
    ])('should watch nothing when %s', (_case, fields) => {
      state(fields);

      watchWantedNick();

      expect(subscribe).not.toHaveBeenCalled();
    });

    it('should take the nick as soon as it is free', () => {
      onNicksOffline(['someone', 'PIOTR']);

      expect(send).toHaveBeenCalledWith('NICK piotr');
    });

    it.each([
      ['another nick freed', ['someone'], {}],
      ['nothing is wanted', ['piotr'], { wantedNick: undefined }],
      ['the nick is ours already', ['piotr'], { nick: 'piotr' }],
    ])('should change nothing when %s', (_case, nicks, fields) => {
      state(fields);

      onNicksOffline(nicks);

      expect(send).not.toHaveBeenCalled();
    });

    it('should end the wait and stop watching once the nick is ours', () => {
      onOwnNickChanged('piotr');

      expect(useSettingsStore.getState().wantedNick).toBeUndefined();
      expect(unsubscribe).toHaveBeenCalledWith(['piotr']);
    });

    it('should keep watching a nick watched for a friend or an open conversation', () => {
      vi.mocked(friendsFile.isFriend).mockReturnValue(true);

      onOwnNickChanged('piotr');

      expect(unsubscribe).not.toHaveBeenCalled();
    });

    it('should keep waiting when our nick changes to another one', () => {
      onOwnNickChanged('piotr__');

      expect(useSettingsStore.getState().wantedNick).toBe('piotr');
    });
  });

  describe('the user deciding', () => {
    it('should stop waiting when the user settles or picks another nick', () => {
      forgetWantedNick();

      expect(useSettingsStore.getState().wantedNick).toBeUndefined();
      expect(unsubscribe).toHaveBeenCalledWith(['piotr']);
    });

    it('should not unsubscribe while disconnected', () => {
      state({ isConnected: false });

      forgetWantedNick();

      expect(useSettingsStore.getState().wantedNick).toBeUndefined();
      expect(unsubscribe).not.toHaveBeenCalled();
    });

    it('should ask NickServ to free the nick, its answer going to the window being looked at', () => {
      reclaimWantedNick();

      expect(command).toHaveBeenCalledWith('PRIVMSG NickServ :GHOST piotr', { window: '#home' });
      expect(send).not.toHaveBeenCalled();
    });

    it('should try the nick a moment after asking where nothing reports it free', () => {
      vi.useFakeTimers();
      state({ monitorLimit: 0, watchLimit: 0 });

      reclaimWantedNick();
      vi.advanceTimersByTime(2000);

      expect(send).toHaveBeenCalledWith('NICK piotr');
    });

    it('should not try again once the nick came back meanwhile', () => {
      vi.useFakeTimers();
      state({ monitorLimit: 0, watchLimit: 0 });

      reclaimWantedNick();
      state({ nick: 'piotr' });
      vi.advanceTimersByTime(2000);

      expect(send).not.toHaveBeenCalled();
    });

    it('should ask nothing when not waiting', () => {
      state({ wantedNick: undefined });

      reclaimWantedNick();

      expect(command).not.toHaveBeenCalled();
    });
  });
});
