/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import * as capabilitiesFile from '@/network/irc/capabilities';
import * as networkFile from '@/network/irc/network';
import * as notificationsFile from '@/runtime/notifications';
import * as soundsFile from '@features/sounds/sounds';
import { clearReadMarkers } from '@/network/irc/readMarkers';
import { clearServiceRequests, noteServiceRequest } from '@/network/irc/serviceRequests';
import { createLabel } from '@/network/irc/labels';
import * as awayMessagesFile from '@features/channels/store/awayMessages';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { ChannelCategory } from '@shared/types';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/message', () => {
  setupKernelTest();

  it('test raw NOTICE #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = '@draft/bot;msgid=mcOQVkbTRyuCcC0Rso27IB;time=2023-02-22T00:20:59.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik NOTICE mero-test :[#religie] Dla trolli są inne kanały...';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '[#religie] Dla trolli są inne kanały...' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getConnectedTime').mockImplementation(() => Math.floor(Date.now() / 1000) - 5);
    const mockSetListRequestRemainingSeconds = vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledTimes(1);
    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledWith(15);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw NOTICE #4', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getConnectedTime').mockImplementation(() => Math.floor(Date.now() / 1000) - 5);
    const mockSetListRequestRemainingSeconds = vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});

    const line = ':irc.librairc.net NOTICE SIC-test :*** You cannot list within the first 60 seconds of connecting. Please try again later.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledTimes(1);
    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledWith(55);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw NOTICE password required - Polish version', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':NickServ!NickServ@services.example.com NOTICE TestUser :Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie, zaloguj się za pomocą /msg NickServ IDENTIFY hasło.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie, zaloguj się za pomocą /msg NickServ IDENTIFY hasło.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE password required - English version 1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':NickServ!NickServ@services.example.com NOTICE TestUser :This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE password required - English version 2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':NickServ!NickServ@services.example.com NOTICE TestUser :This nickname is registered. Please choose a different nickname, or identify via /msg NickServ IDENTIFY password.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'This nickname is registered. Please choose a different nickname, or identify via /msg NickServ IDENTIFY password.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE password required - should not trigger for non-NickServ messages', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':ChanServ!ChanServ@services.example.com NOTICE TestUser :This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.';

    new Kernel({ type: 'raw', line }).handle();

    // getCurrentNick is not called for non-NickServ messages since the condition nick === 'NickServ' fails early
    expect(mockGetCurrentNick).not.toHaveBeenCalled();

    // Should NOT trigger password required logic for non-NickServ messages
    expect(mockSetIsPasswordRequired).not.toHaveBeenCalled();
    expect(mockSetWizardStep).not.toHaveBeenCalled();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE password required - should not trigger for different target', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':NickServ!NickServ@services.example.com NOTICE OtherUser :This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.';

    new Kernel({ type: 'raw', line }).handle();

    // Should NOT trigger password required logic for different target
    expect(mockSetIsPasswordRequired).not.toHaveBeenCalled();
    expect(mockSetWizardStep).not.toHaveBeenCalled();

    // Services' notices go to Status
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE password required - pirc.pl full message with bot tags', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line1 = '@draft/bot;bot;msgid=TCbDwGyUnF2F7Qld1yjerB;time=2026-02-10T20:05:51.461Z :NickServ!NickServ@serwisy.pirc.pl NOTICE Merovingian :Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie,';
    const line2 = '@draft/bot;bot;msgid=T1hegrg6hUempamIIW9PSy;time=2026-02-10T20:05:51.461Z :NickServ!NickServ@serwisy.pirc.pl NOTICE Merovingian :wpisz /msg NickServ IDENTIFY hasło. W przeciwnym wypadku';
    const line3 = '@draft/bot;bot;msgid=432tKFt5KgEFZrFfWQVg1J;time=2026-02-10T20:05:51.461Z :NickServ!NickServ@serwisy.pirc.pl NOTICE Merovingian :wybierz proszę inny nick.';
    const line4 = '@draft/bot;bot;msgid=VHNhxCj6yAnC8AagfIapH6;time=2026-02-10T20:05:51.461Z :NickServ!NickServ@serwisy.pirc.pl NOTICE Merovingian :Jeśli go nie zmienisz w ciągu 20 sekund(y), zostanie zmieniony siłą.';

    new Kernel({ type: 'raw', line: line1 }).handle();

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);
    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');

    vi.clearAllMocks();
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    const mockSetIsPasswordRequired2 = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep2 = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    new Kernel({ type: 'raw', line: line2 }).handle();
    new Kernel({ type: 'raw', line: line3 }).handle();
    new Kernel({ type: 'raw', line: line4 }).handle();

    // Subsequent lines should NOT trigger password check again
    expect(mockSetIsPasswordRequired2).not.toHaveBeenCalled();
    expect(mockSetWizardStep2).not.toHaveBeenCalled();
  });

  it('test raw NOTICE password required - Libera.Chat full message', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = '@time=2026-02-10T20:07:19.292Z :NickServ!NickServ@services.libera.chat NOTICE Merovingian :This nickname is registered. Please choose a different nickname, or identify via /msg NickServ IDENTIFY dilfridge <password>';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      target: STATUS_CHANNEL,
      message: 'This nickname is registered. Please choose a different nickname, or identify via /msg NickServ IDENTIFY dilfridge <password>',
    }));
  });

  it('test raw NOTICE password required - Libera.Chat with IRC bold formatting codes', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    // NickServ message with \x02 (bold) formatting around the command
    const line = '@time=2026-02-10T20:25:41.735Z :NickServ!NickServ@services.libera.chat NOTICE Merovingian :This nickname is registered. Please choose a different nickname, or identify via \x02/msg NickServ identify <password>\x02.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');
  });

  it('test raw NOTICE password required after server nick change in 001', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    // Server assigned a different nick than requested
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian_');

    // NickServ sends NOTICE to the server-assigned nick
    const line = '@draft/bot;bot;msgid=TCbDwGyUnF2F7Qld1yjerB;time=2026-02-10T20:05:51.461Z :NickServ!NickServ@serwisy.pirc.pl NOTICE Merovingian_ :Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie,';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');
  });

  it('test raw PRIVMSG #1 channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockExistChannel = vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
    const mockSetIncreaseUnreadMessages = vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

    const line = '@batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetIncreaseUnreadMessages).toHaveBeenCalledTimes(0);

    expect(mockExistChannel).toHaveBeenCalledTimes(1);
    expect(mockExistChannel).toHaveBeenCalledWith('#sic');

    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('#sic', 'SIC-test2', 'done');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'test 1' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw PRIVMSG #1 priv', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockExistChannel = vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
    const mockSetIncreaseUnreadMessages = vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

    const line = '@batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG SIC-test :test 1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockExistChannel).toHaveBeenCalledTimes(1);
    expect(mockExistChannel).toHaveBeenCalledWith('SIC-test2');

    expect(mockSetIncreaseUnreadMessages).toHaveBeenCalledTimes(1);
    expect(mockSetIncreaseUnreadMessages).toHaveBeenCalledWith('SIC-test2');

    expect(mockSetTyping).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: 'SIC-test2', message: 'test 1' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a message', '@msgid=abc;time=2023-02-12T02:06:12.210Z :Friend!~u@host PRIVMSG #sic :hi', 'abc'],
    ['an action', '@msgid=abc;time=2023-02-12T02:06:12.210Z :Friend!~u@host PRIVMSG #sic :\x01ACTION waves\x01', 'abc'],
    ['a message from a server without msgid', ':Friend!~u@host PRIVMSG #sic :hi', undefined],
  ])('test raw PRIVMSG keeps the server msgid of %s, for reactions to refer to', (_case, line, msgid) => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ target: '#sic' }));
    expect(mockSetAddMessage.mock.lastCall?.[0].msgid).toBe(msgid);
  });

  it.each([
    ['a message', '@+draft/reply=q1;msgid=abc :Friend!~u@host PRIVMSG #sic :yes', 'q1'],
    ['an action', '@+draft/reply=q1;msgid=abc :Friend!~u@host PRIVMSG #sic :\x01ACTION nods\x01', 'q1'],
    ['a message replying to nothing', '@msgid=abc :Friend!~u@host PRIVMSG #sic :hi', undefined],
  ])('test raw PRIVMSG keeps what %s replies to', (_case, line, replyTo) => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage.mock.lastCall?.[0].replyTo).toBe(replyTo);
  });

  it('test raw NOTICE addressed to an open channel is routed to that channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
    vi.spyOn(settingsFile, 'getChannelTypes').mockImplementation(() => ['#', '&']);
    vi.spyOn(channelsFile, 'existChannel').mockImplementation((name: string) => name === '#sic');

    const line = ':Someone!~user@host NOTICE #sic :channel announcement';

    new Kernel({ type: 'raw', line }).handle();

    // The notice lands in #sic, not in the currently viewed #other
    expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#sic', message: 'channel announcement' }));
  });

  it('test raw NOTICE addressed to us goes to the current window', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
    vi.spyOn(settingsFile, 'getChannelTypes').mockImplementation(() => ['#', '&']);

    const line = ':Someone!~user@host NOTICE MyNick :psst';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#other', message: 'psst' }));
  });

  it('test raw 401 - no such nick/channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 401 sic-test unknownuser :No such nick/channel';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('unknownuser') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 404 - cannot send to channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 404 sic-test #sic :You cannot send messages to channels until you\'ve been connected for 30 seconds';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 412 - no text to send', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 412 sic-test :No text to send';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  describe('Private message window creation', () => {
    it('should create priv channel for incoming private message without touching the users store', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      const mockSetAddChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      // Should create priv channel; participants are derived from the window name, not stored
      expect(mockSetAddChannel).toHaveBeenCalledWith('OtherUser', ChannelCategory.priv);
      expect(mockSetAddUser).not.toHaveBeenCalled();
      expect(mockSetJoinUser).not.toHaveBeenCalled();
    });

    it('should create priv channel for own echoed direct message', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      const mockSetAddChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation((cap) => cap === 'echo-message');

      // Our own message to OtherUser echoed back by the server
      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :MyNick!~me@host PRIVMSG OtherUser :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      // The window is named after the peer and categorized as priv, not channel
      expect(mockSetAddChannel).toHaveBeenCalledWith('OtherUser', ChannelCategory.priv);
    });

    it('should not add users to channel for regular channel messages', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#test');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

      // This is a channel message, not a private message
      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      // Should NOT add users for channel messages
      expect(mockSetAddUser).not.toHaveBeenCalled();
      expect(mockSetJoinUser).not.toHaveBeenCalled();
    });

    it('should not add users when priv channel already exists', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      // Channel already exists
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => 'OtherUser');
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);

      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :Hello again';

      new Kernel({ type: 'raw', line }).handle();

      // Channel already exists, so no users should be added
      expect(mockSetAddUser).not.toHaveBeenCalled();
      expect(mockSetJoinUser).not.toHaveBeenCalled();
    });

    it('should create priv channel for CTCP ACTION in private message without touching the users store', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      const mockSetAddChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

      // CTCP ACTION in private message
      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :\x01ACTION waves\x01';

      new Kernel({ type: 'raw', line }).handle();

      // Should create priv channel; participants are derived from the window name, not stored
      expect(mockSetAddChannel).toHaveBeenCalledWith('OtherUser', ChannelCategory.priv);
      expect(mockSetAddUser).not.toHaveBeenCalled();
      expect(mockSetJoinUser).not.toHaveBeenCalled();
    });
  });

  describe('Nick mention highlighting', () => {
    it('should set highlight on private message', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: 'OtherUser', highlight: true }));
    });

    it('should set highlight when message mentions nick in channel', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :hey MyNick check this out';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: true }));
    });

    it('should set highlight with case-insensitive nick match', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :hello mynick!';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: true }));
    });

    it('should not set highlight when message does not mention nick', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :hello everyone';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: false }));
    });

    it('should not set highlight on echo messages', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation((cap) => cap === 'echo-message');

      // Echo message: sender is MyNick (our own message echoed back)
      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :MyNick!~user@host PRIVMSG #channel :hello MyNick';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: false }));
    });

    it('should call setHasMention for mentioned nick in non-current channel', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      const mockSetHasMention = vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :hey MyNick!';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetHasMention).toHaveBeenCalledWith('#channel');
    });

    it('should not call setHasMention when message is in current channel', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      const mockSetHasMention = vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :hey MyNick!';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetHasMention).not.toHaveBeenCalled();
    });

    it('should not call setHasMention when no nick mention', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      const mockSetHasMention = vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :hello everyone';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetHasMention).not.toHaveBeenCalled();
    });

    it('should set highlight on CTCP ACTION that mentions nick', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :\x01ACTION waves at MyNick\x01';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: true }));
    });

    it('should set highlight on CTCP ACTION in private message', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :\x01ACTION waves\x01';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: 'OtherUser', highlight: true }));
    });

    it('should not set highlight on CTCP ACTION without nick mention in channel', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :\x01ACTION dances\x01';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: false }));
    });

    it('should call setHasMention for CTCP ACTION with nick mention in non-current channel', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      const mockSetHasMention = vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :\x01ACTION pokes MyNick\x01';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetHasMention).toHaveBeenCalledWith('#channel');
    });
  });

  describe('Highlight words', () => {
    const mockChannelEnvironment = (flags: string[] = []) => {
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => flags);
      vi.spyOn(settingsFile, 'getHighlightWords').mockImplementation(() => ['deploy', 'build failed']);
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      return {
        setAddMessage: vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {}),
        setHasMention: vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {}),
        notifyHighlight: vi.spyOn(notificationsFile, 'notifyHighlight').mockResolvedValue(),
        addAwayMessage: vi.spyOn(awayMessagesFile, 'addAwayMessage').mockImplementation(() => {}),
      };
    };

    it('should highlight a message containing one of the words, and announce it', () => {
      const mocks = mockChannelEnvironment();

      new Kernel({ type: 'raw', line: ':OtherUser!~user@host PRIVMSG #channel :the Build Failed again' }).handle();

      expect(mocks.setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: true }));
      expect(mocks.setHasMention).toHaveBeenCalledWith('#channel');
      expect(mocks.notifyHighlight).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', message: 'the Build Failed again' }));
    });

    it('should announce a highlight as plain text, a spoiler kept hidden', () => {
      const mocks = mockChannelEnvironment();

      new Kernel({ type: 'raw', line: ':OtherUser!~user@host PRIVMSG #channel :the \x02deploy\x02 is \x0314,14delayed\x03' }).handle();

      expect(mocks.notifyHighlight).toHaveBeenCalledWith(expect.objectContaining({ message: 'the deploy is ▒▒▒' }));
    });

    it('should highlight an ACTION containing one of the words', () => {
      const mocks = mockChannelEnvironment();

      new Kernel({ type: 'raw', line: ':OtherUser!~user@host PRIVMSG #channel :\x01ACTION starts the deploy\x01' }).handle();

      expect(mocks.setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: true }));
    });

    it('should not highlight a word or the nick standing inside another word', () => {
      const mocks = mockChannelEnvironment();

      new Kernel({ type: 'raw', line: ':OtherUser!~user@host PRIVMSG #channel :redeployed by MyNickname' }).handle();

      expect(mocks.setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: false }));
      expect(mocks.setHasMention).not.toHaveBeenCalled();
    });

    it('should not highlight an own message containing one of the words', () => {
      const mocks = mockChannelEnvironment();

      new Kernel({ type: 'raw', line: ':MyNick!~user@host PRIVMSG #channel :deploy done' }).handle();

      expect(mocks.setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', highlight: false }));
    });

    it('should keep a message with one of the words for later while away', () => {
      const mocks = mockChannelEnvironment(['away']);

      new Kernel({ type: 'raw', line: ':OtherUser!~user@host PRIVMSG #channel :deploy now' }).handle();

      expect(mocks.addAwayMessage).toHaveBeenCalledWith(expect.objectContaining({ message: 'deploy now' }));
    });
  });

  describe('Notice routing', () => {
    const mockNoticeEnvironment = (openWindows: string[]) => {
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#viewing');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation((name) => openWindows.some((open) => open.toLowerCase() === name.toLowerCase()));
      const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      return (line: string) => {
        setAddMessage.mockClear();
        new Kernel({ type: 'raw', line }).handle();
        return setAddMessage.mock.calls.map(([message]) => message).filter((message) => message.target !== DEBUG_CHANNEL);
      };
    };

    beforeEach(() => {
      clearServiceRequests();
    });

    it('should send what services say unasked to Status', () => {
      const notice = mockNoticeEnvironment(['#viewing', STATUS_CHANNEL]);

      expect(notice(':NickServ!NickServ@services NOTICE MyNick :Password accepted - you are now recognized.')).toEqual([expect.objectContaining({ target: STATUS_CHANNEL })]);
      expect(notice(':HostServ!HostServ@services NOTICE MyNick :Your vhost is now activated.')).toEqual([expect.objectContaining({ target: STATUS_CHANNEL })]);
    });

    it('should send a service\'s answer to the window the user wrote to it from', () => {
      const notice = mockNoticeEnvironment(['#viewing', '#asked-from', STATUS_CHANNEL]);
      noteServiceRequest('PRIVMSG NickServ :INFO', '#asked-from');

      expect(notice(':NickServ!NickServ@services NOTICE MyNick :Information on MyNick')).toEqual([expect.objectContaining({ target: '#asked-from' })]);
      expect(notice(':ChanServ!ChanServ@services NOTICE MyNick :You are not authorized.')).toEqual([expect.objectContaining({ target: STATUS_CHANNEL })]);
    });

    it('should send a labeled answer to the window of its command', () => {
      const notice = mockNoticeEnvironment(['#viewing', '#labeled', STATUS_CHANNEL]);
      const label = createLabel({ window: '#labeled' });

      expect(notice(`@label=${label} :NickServ!NickServ@services NOTICE MyNick :Information on MyNick`)).toEqual([expect.objectContaining({ target: '#labeled' })]);
    });

    it('should fall back to Status when the window asked from is closed', () => {
      const notice = mockNoticeEnvironment(['#viewing', STATUS_CHANNEL]);
      noteServiceRequest('PRIVMSG NickServ :INFO', '#closed-since');

      expect(notice(':NickServ!NickServ@services NOTICE MyNick :Information on MyNick')).toEqual([expect.objectContaining({ target: STATUS_CHANNEL })]);
    });

    it('should send a channel greeting to that channel', () => {
      const notice = mockNoticeEnvironment(['#viewing', '#religie', STATUS_CHANNEL]);

      expect(notice(':Pomocnik!pomocny@bot NOTICE MyNick :[#religie] Dla trolli są inne kanały...')).toEqual([expect.objectContaining({ target: '#religie' })]);
      expect(notice(':ChanServ!ChanServ@services NOTICE MyNick :[#Religie] Welcome!')).toEqual([expect.objectContaining({ target: '#Religie' })]);
    });

    it.each([
      ['a channel not open', ':Pomocnik!pomocny@bot NOTICE MyNick :[#elsewhere] Hello'],
      ['a bracketed word that is no channel', ':alice!a@host NOTICE MyNick :[info] the build is green'],
      ['a user\'s ordinary notice', ':alice!a@host NOTICE MyNick :ping me later'],
    ])('should keep %s in the current window', (_, line) => {
      const notice = mockNoticeEnvironment(['#viewing', STATUS_CHANNEL]);

      expect(notice(line)).toEqual([expect.objectContaining({ target: '#viewing' })]);
    });
  });

  describe('Notification sounds', () => {
    const mockSoundEnvironment = () => {
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddHistoryPage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(notificationsFile, 'notifyHighlight').mockResolvedValue();
      return vi.spyOn(soundsFile, 'playHighlightSound').mockImplementation(() => {});
    };

    it('should play for a mention in a channel', () => {
      const playHighlightSound = mockSoundEnvironment();

      new Kernel({ type: 'raw', line: ':OtherUser!~user@host PRIVMSG #channel :MyNick: ping' }).handle();

      expect(playHighlightSound).toHaveBeenCalledWith('#channel', false);
    });

    it('should play for a private message and a private ACTION', () => {
      const playHighlightSound = mockSoundEnvironment();

      new Kernel({ type: 'raw', line: ':Friend!~user@host PRIVMSG MyNick :hi' }).handle();
      new Kernel({ type: 'raw', line: ':Friend!~user@host PRIVMSG MyNick :\x01ACTION waves\x01' }).handle();

      expect(playHighlightSound.mock.calls).toEqual([['Friend', true], ['Friend', true]]);
    });

    it('should not play for an ordinary channel message, an own message or a notice', () => {
      const playHighlightSound = mockSoundEnvironment();

      new Kernel({ type: 'raw', line: ':OtherUser!~user@host PRIVMSG #channel :hello all' }).handle();
      new Kernel({ type: 'raw', line: ':MyNick!~user@host PRIVMSG #channel :MyNick here' }).handle();
      new Kernel({ type: 'raw', line: ':OtherUser!~user@host NOTICE MyNick :MyNick, psst' }).handle();

      expect(playHighlightSound).not.toHaveBeenCalled();
    });

    it('should not play for a mention replayed from history', () => {
      const playHighlightSound = mockSoundEnvironment();

      for (const line of [
        'BATCH +hist chathistory #channel',
        '@batch=hist;time=2026-10-23T10:00:00.000Z :OtherUser!~user@host PRIVMSG #channel :MyNick: old ping',
        '@batch=hist;time=2026-10-23T10:00:01.000Z :Friend!~user@host PRIVMSG MyNick :old hello',
        'BATCH -hist',
      ]) {
        new Kernel({ type: 'raw', line }).handle();
      }

      expect(playHighlightSound).not.toHaveBeenCalled();
    });
  });

  describe('Own messages from other clients (znc.in/self-message)', () => {
    const mockOwnMessageEnvironment = () => {
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => ['away']);
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation(() => false);
      return {
        setAddMessage: vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {}),
        setIncreaseUnreadMessages: vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {}),
        setHasMention: vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {}),
        setTyping: vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {}),
        notifyHighlight: vi.spyOn(notificationsFile, 'notifyHighlight').mockImplementation(async () => {}),
        addAwayMessage: vi.spyOn(awayMessagesFile, 'addAwayMessage').mockImplementation(() => {}),
        ircSendRawMessage: vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {}),
      };
    };

    it('should show a direct message sent from another client in the peer window as our own, without echo-message', () => {
      const mocks = mockOwnMessageEnvironment();

      const line = '@msgid=own1;time=2023-02-12T02:06:12.210Z :MyNick!~user@host PRIVMSG Friend :sent from my phone, MyNick';

      new Kernel({ type: 'raw', line }).handle();

      expect(mocks.setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: 'Friend', message: 'sent from my phone, MyNick', highlight: false, echoed: false }));
      expect(mocks.setIncreaseUnreadMessages).not.toHaveBeenCalled();
      expect(mocks.setHasMention).not.toHaveBeenCalled();
      expect(mocks.notifyHighlight).not.toHaveBeenCalled();
      expect(mocks.addAwayMessage).not.toHaveBeenCalled();
    });

    it('should not count a channel message sent from another client as unread', () => {
      const mocks = mockOwnMessageEnvironment();

      const line = '@msgid=own2;time=2023-02-12T02:06:12.210Z :MyNick!~user@host PRIVMSG #channel :hello';

      new Kernel({ type: 'raw', line }).handle();

      expect(mocks.setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#channel', message: 'hello', highlight: false }));
      expect(mocks.setIncreaseUnreadMessages).not.toHaveBeenCalled();
      expect(mocks.setTyping).not.toHaveBeenCalled();
    });

    it('should not count an ACTION sent from another client as unread or a highlight', () => {
      const mocks = mockOwnMessageEnvironment();

      const line = '@msgid=own3;time=2023-02-12T02:06:12.210Z :MyNick!~user@host PRIVMSG Friend :\x01ACTION waves\x01';

      new Kernel({ type: 'raw', line }).handle();

      expect(mocks.setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: 'Friend', message: 'waves', highlight: false }));
      expect(mocks.setIncreaseUnreadMessages).not.toHaveBeenCalled();
      expect(mocks.notifyHighlight).not.toHaveBeenCalled();
    });

    it('should hide a message to services sent from another client, without echo-message', () => {
      const mocks = mockOwnMessageEnvironment();

      const line = ':MyNick!~user@host PRIVMSG NickServ :IDENTIFY secret';

      new Kernel({ type: 'raw', line }).handle();

      expect(mocks.setAddMessage).toHaveBeenCalledTimes(1); // the debug line only
    });

    it('should not answer our own CTCP request', () => {
      const mocks = mockOwnMessageEnvironment();

      const line = ':MyNick!~user@host PRIVMSG Friend :\x01VERSION\x01';

      new Kernel({ type: 'raw', line }).handle();

      expect(mocks.ircSendRawMessage).not.toHaveBeenCalled();
      expect(mocks.setAddMessage).toHaveBeenCalledTimes(1); // the debug line only
    });

    it('should still answer a CTCP request from someone else', () => {
      const mocks = mockOwnMessageEnvironment();

      const line = ':Friend!~user@host PRIVMSG MyNick :\x01VERSION\x01';

      new Kernel({ type: 'raw', line }).handle();

      expect(mocks.ircSendRawMessage).toHaveBeenCalledWith(expect.stringContaining('NOTICE Friend :\x01VERSION '));
    });
  });

  describe('Read marker (draft/read-marker)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      clearReadMarkers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const mockReadMarkerEnvironment = () => {
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current');
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation((cap) => cap === 'draft/read-marker');
      return vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    };

    it('should mark the window being read as read up to a message that arrives in it', () => {
      const send = mockReadMarkerEnvironment();

      new Kernel({ type: 'raw', line: '@time=2026-10-22T10:00:00.000Z :Friend!~u@host PRIVMSG #current :one' }).handle();
      new Kernel({ type: 'raw', line: '@time=2026-10-22T10:00:01.000Z :Friend!~u@host PRIVMSG #current :\x01ACTION waves\x01' }).handle();
      vi.runAllTimers();

      expect(send).toHaveBeenCalledExactlyOnceWith('MARKREAD #current timestamp=2026-10-22T10:00:01.000Z');
    });

    it('should leave other windows unread', () => {
      const send = mockReadMarkerEnvironment();

      new Kernel({ type: 'raw', line: '@time=2026-10-22T10:00:00.000Z :Friend!~u@host PRIVMSG #other :one' }).handle();
      new Kernel({ type: 'raw', line: '@time=2026-10-22T10:00:00.000Z :Friend!~u@host PRIVMSG MyNick :hi' }).handle();
      vi.runAllTimers();

      expect(send).not.toHaveBeenCalled();
    });

    it('should not put our own clock in a marker when the server sends no time', () => {
      const send = mockReadMarkerEnvironment();

      new Kernel({ type: 'raw', line: ':Friend!~u@host PRIVMSG #current :one' }).handle();
      vi.runAllTimers();

      expect(send).not.toHaveBeenCalled();
    });
  });
});
