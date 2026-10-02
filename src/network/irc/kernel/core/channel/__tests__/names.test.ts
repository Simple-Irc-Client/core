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

describe('kernel core/channel/names', () => {
  setupKernelTest();

  it('test raw 353 #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockBufferNamesUsers = vi.spyOn(usersFile, 'bufferNamesUsers').mockImplementation(() => {});

    const line =
      ':chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia +Alisha!~user@397FF66D:D8E4ABEE:5838DA6D:IP +ProrokCodzienny!~ProrokCod@AB43659:6EA4AE53:B58B785A:IP &@Pomocnik!pomocny@bot:kanalowy.pomocnik';

    new Kernel({ type: 'raw', line }).handle();

    // The whole roster goes to the store in one call, so the modes are read once
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockBufferNamesUsers).toHaveBeenCalledTimes(1);
    expect(mockBufferNamesUsers).toHaveBeenCalledWith('#Religie', [
      { nick: 'aleksa7', ident: '~aleksa7', hostname: 'vhost:kohana.aleksia', flags: [], maxPermission: -1 },
      { nick: 'Alisha', ident: '~user', hostname: '397FF66D:D8E4ABEE:5838DA6D:IP', flags: ['v'], maxPermission: 251 },
      { nick: 'ProrokCodzienny', ident: '~ProrokCod', hostname: 'AB43659:6EA4AE53:B58B785A:IP', flags: ['v'], maxPermission: 251 },
      { nick: 'Pomocnik', ident: 'pomocny', hostname: 'bot:kanalowy.pomocnik', flags: ['a', 'o'], maxPermission: 254 },
    ]);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 353 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockBufferNamesUsers = vi.spyOn(usersFile, 'bufferNamesUsers').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockBufferNamesUsers).toHaveBeenCalledWith('#Religie', [
      { nick: 'aleksa7', ident: '~aleksa7', hostname: 'vhost:kohana.aleksia', flags: [], maxPermission: -1 },
    ]);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 353 #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockBufferNamesUsers = vi.spyOn(usersFile, 'bufferNamesUsers').mockImplementation(() => {});

    const line =
      ':irc01-black.librairc.net 353 mero-test = #chat :ircbot!ircbot@ircbot.botop.librairc.net Freak!Freak@LibraIRC-ug4.vta.mvnbg3.IP WatchDog!WatchDog@Watchdog.botop.librairc.net !~@iBan!iBan@iBan.botop.librairc.net !iBot!iBot@iBot.botop.librairc.net';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockBufferNamesUsers).toHaveBeenCalledWith('#chat', [
      { nick: 'ircbot', ident: 'ircbot', hostname: 'ircbot.botop.librairc.net', flags: [], maxPermission: -1 },
      { nick: 'Freak', ident: 'Freak', hostname: 'LibraIRC-ug4.vta.mvnbg3.IP', flags: [], maxPermission: -1 },
      { nick: 'WatchDog', ident: 'WatchDog', hostname: 'Watchdog.botop.librairc.net', flags: [], maxPermission: -1 },
      { nick: 'iBan', ident: 'iBan', hostname: 'iBan.botop.librairc.net', flags: ['y', 'q', 'o'], maxPermission: 256 },
      { nick: 'iBot', ident: 'iBot', hostname: 'iBot.botop.librairc.net', flags: ['y'], maxPermission: 256 },
    ]);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 366', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockFlushNamesUsers = vi.spyOn(usersFile, 'flushNamesUsers').mockImplementation(() => {});

    const line = ':bzyk.pirc.pl 366 SIC-test #sic :End of /NAMES list.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockFlushNamesUsers).toHaveBeenCalledExactlyOnceWith('#sic');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('should apply a roster split across several 353 lines as one store update on 366', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    usersFile.setUsersClearAll();

    let storeUpdates = 0;
    const unsubscribe = usersFile.useUsersStore.subscribe(() => { storeUpdates++; });

    for (const line of [
      ':chmurka.pirc.pl 353 sic-test = #sic :alice!~a@host.one bob!~b@host.two',
      ':chmurka.pirc.pl 353 sic-test = #sic :@carol!~c@host.three',
    ]) {
      new Kernel({ type: 'raw', line }).handle();
    }

    // Nothing reaches the store until the roster is closed
    expect(storeUpdates).toBe(0);
    expect(usersFile.useUsersStore.getState().users).toHaveLength(0);

    new Kernel({ type: 'raw', line: ':chmurka.pirc.pl 366 sic-test #sic :End of /NAMES list.' }).handle();
    unsubscribe();

    // The whole roster in a single update, however many lines carried it
    expect(storeUpdates).toBe(1);
    expect(usersFile.useUsersStore.getState().users.map((user) => user.nick)).toEqual(['alice', 'bob', 'carol']);
    expect(usersFile.getUser('carol')?.channels).toEqual([{ name: '#sic', flags: ['o'], maxPermission: 253 }]);
  });

  it('should close a roster whose 366 echoes a different casing', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    usersFile.setUsersClearAll();

    new Kernel({ type: 'raw', line: ':chmurka.pirc.pl 353 sic-test = #Religie :alice!~a@host.one' }).handle();
    new Kernel({ type: 'raw', line: ':chmurka.pirc.pl 366 sic-test #religie :End of /NAMES list.' }).handle();

    // The roster's own casing is what gets stored, not the one on the closing line
    expect(usersFile.getUser('alice')?.channels).toEqual([{ name: '#Religie', flags: [], maxPermission: -1 }]);
  });

  it('should not strand a roster the server never closes', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    usersFile.setUsersClearAll();

    // 1000 buffered nicks is the safety valve; 100 per line keeps the lines realistic
    for (let batch = 0; batch < 10; batch++) {
      const nicks = Array.from({ length: 100 }, (_, i) => `user${batch * 100 + i}!~u@host`).join(' ');
      new Kernel({ type: 'raw', line: `:chmurka.pirc.pl 353 sic-test = #sic :${nicks}` }).handle();
    }

    // No 366 ever arrives, yet the users are there
    expect(usersFile.useUsersStore.getState().users).toHaveLength(1000);
  });
});
