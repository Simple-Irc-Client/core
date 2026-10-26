/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as networksStore from '@features/networks/store/networks';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { MessageCategory } from '@shared/types';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel: HELP, ADMIN and STATS replies', () => {
  setupKernelTest();

  const shown = (line: string) => {
    vi.spyOn(networksStore, 'getCurrentChannelName').mockImplementation(() => '#current');
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    new Kernel({ type: 'raw', line }).handle();

    return setAddMessage.mock.calls.map(([message]) => message).filter((message) => message.target !== DEBUG_CHANNEL)
      .map(({ message, target, category }) => ({ message, target, category }));
  };

  it.each([
    [':server 704 me privmsg :** Help for PRIVMSG **', '[privmsg] ** Help for PRIVMSG **'],
    [':server 705 me privmsg :Sends a message to a user or channel', 'Sends a message to a user or channel'],
    [':server 706 me privmsg :End of /HELP', '[privmsg] End of /HELP'],
  ])('should show the HELP line %s where the command was typed', (line, message) => {
    expect(shown(line)).toEqual([{ message, target: '#current', category: MessageCategory.info }]);
  });

  it('should show a help topic that was not found as an error', () => {
    expect(shown(':server 524 me nosuch :Help not found')).toEqual([{ message: 'nosuch: Help not found', target: '#current', category: MessageCategory.error }]);
  });

  it.each([
    [':server 256 me :Administrative info about irc.example.org'],
    [':server 257 me :Somewhere, Earth'],
    [':server 258 me :Example Network'],
    [':server 259 me :admin@example.org'],
  ])('should show the ADMIN line %s in Status', (line) => {
    expect(shown(line)).toEqual([{ message: line.slice(line.indexOf(' :') + 2), target: STATUS_CHANNEL, category: MessageCategory.info }]);
  });

  it('should show a STATS command count in Status', () => {
    expect(shown(':server 212 me PRIVMSG 120 4800 0')).toEqual([{ message: 'PRIVMSG 120 4800 0', target: STATUS_CHANNEL, category: MessageCategory.info }]);
  });

  it.each([
    [':server 242 me :Server Up 14 days, 2:34:56', 'Server Up 14 days, 2:34:56'],
    [':server 219 me u :End of /STATS report', 'u End of /STATS report'],
  ])('should show the STATS line %s in Status', (line, message) => {
    expect(shown(line)).toEqual([{ message, target: STATUS_CHANNEL, category: MessageCategory.info }]);
  });
});
