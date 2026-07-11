/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Kernel } from '../kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import { setScriptDispatcher } from '@features/scripts/hook';
import type { ScriptEvent, ScriptEventResult } from '@features/scripts/types';
import { PASS_THROUGH } from '@features/scripts/types';

const PRIVMSG_LINE = '@msgid=HPS1IK0ruo8t691kVDRtFl;time=2023-02-12T02:11:26.770Z :alice!~a@host PRIVMSG #sic :hello world';

describe('kernel script hooks', () => {
  const defaultUserModes = [
    { symbol: '@', flag: 'o' },
    { symbol: '+', flag: 'v' },
  ];

  let addMessage: ReturnType<typeof vi.spyOn>;
  let increaseUnread: ReturnType<typeof vi.spyOn>;
  let hasMention: ReturnType<typeof vi.spyOn>;
  let addChannel: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
    increaseUnread = vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
    hasMention = vi.spyOn(channelsFile, 'setHasMention').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
    addChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
    vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
    vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
  });

  afterEach(() => {
    setScriptDispatcher(null);
    vi.restoreAllMocks();
  });

  it('delivers a semantic message event with the parsed payload', () => {
    const events: ScriptEvent[] = [];
    setScriptDispatcher((event) => {
      events.push(event);
      return PASS_THROUGH;
    });

    new Kernel({ type: 'raw', line: PRIVMSG_LINE }).handle();

    expect(events).toEqual([
      { type: 'raw', line: PRIVMSG_LINE },
      {
        type: 'message',
        nick: 'alice',
        target: '#sic',
        text: 'hello world',
        self: false,
        tags: expect.objectContaining({ msgid: 'HPS1IK0ruo8t691kVDRtFl' }) as Record<string, string>,
      },
    ]);
  });

  it('a blocked message causes no side effects at all', () => {
    setScriptDispatcher((event): ScriptEventResult =>
      (event.type === 'message' ? { blocked: true } : PASS_THROUGH));

    new Kernel({ type: 'raw', line: PRIVMSG_LINE }).handle();

    // Only the DEV debug echo may hit setAddMessage — never the #sic message
    const targets = addMessage.mock.calls.map((call: unknown[]) => (call[0] as { target: string }).target);
    expect(targets).not.toContain('#sic');
    expect(increaseUnread).not.toHaveBeenCalled();
    expect(hasMention).not.toHaveBeenCalled();
    expect(addChannel).not.toHaveBeenCalled();
  });

  it('a script can rewrite the message text before it is stored', () => {
    setScriptDispatcher((event): ScriptEventResult =>
      (event.type === 'message' ? { blocked: false, text: 'REWRITTEN' } : PASS_THROUGH));

    new Kernel({ type: 'raw', line: PRIVMSG_LINE }).handle();

    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#sic', message: 'REWRITTEN' }));
  });

  it('a blocked raw line stops all processing', () => {
    const setIsConnected = vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    setScriptDispatcher((event): ScriptEventResult =>
      (event.type === 'raw' ? { blocked: true } : PASS_THROUGH));

    new Kernel({ type: 'raw', line: ':srv 001 SIC-test :Welcome' }).handle();

    expect(setIsConnected).not.toHaveBeenCalled();
  });

  it('emits observe-only join/part/quit/nick events', () => {
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#sic']);
    const events: ScriptEvent[] = [];
    setScriptDispatcher((event) => {
      if (event.type !== 'raw') { events.push(event); }
      return PASS_THROUGH;
    });

    new Kernel({ type: 'raw', line: ':alice!~a@host JOIN :#sic' }).handle();
    new Kernel({ type: 'raw', line: ':alice!~a@host PART #sic :bye' }).handle();
    new Kernel({ type: 'raw', line: ':alice!~a@host QUIT :gone' }).handle();
    new Kernel({ type: 'raw', line: ':alice!~a@host NICK :alicja' }).handle();

    expect(events).toEqual([
      { type: 'join', nick: 'alice', channel: '#sic' },
      { type: 'part', nick: 'alice', channel: '#sic', reason: 'bye' },
      { type: 'quit', nick: 'alice', reason: 'gone' },
      { type: 'nick', oldNick: 'alice', newNick: 'alicja' },
    ]);
  });

  it('a vetoing notice script cannot break the NickServ auto-auth state machine', () => {
    const setIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);
    vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});
    setScriptDispatcher((event): ScriptEventResult =>
      (event.type === 'notice' ? { blocked: true } : PASS_THROUGH));

    new Kernel({ type: 'raw', line: ':NickServ!s@services NOTICE SIC-test :This nickname is registered' }).handle();

    // The auth state machine ran even though the notice display was blocked
    expect(setIsPasswordRequired).toHaveBeenCalledWith(true);
    const targets = addMessage.mock.calls.map((call: unknown[]) => (call[0] as { target: string }).target);
    expect(targets).not.toContain('#other');
  });
});
