import { afterEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import { ircHandlers, mergeHandlers } from '@/network/irc/kernel/registry';
import * as channelsFile from '@features/channels/store/channels';

describe('kernel registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects two modules registering the same command', () => {
    const handler = (): void => {};

    expect(() => mergeHandlers({ JOIN: handler }, { JOIN: handler })).toThrow('Duplicate IRC handler for JOIN');
  });

  it('registers core, IRCv3 and extension handlers', () => {
    for (const command of ['PRIVMSG', 'JOIN', '001', '005', 'CAP', 'AUTHENTICATE', 'BATCH', '730', '600', '728']) {
      expect(ircHandlers.has(command), command).toBe(true);
    }
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('does not dispatch Object.prototype member %s', (command) => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    expect(() => new Kernel({ type: 'raw', line: `:server ${command} nick :text` }).handle()).not.toThrow();
    // Debug echo only
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });
});
