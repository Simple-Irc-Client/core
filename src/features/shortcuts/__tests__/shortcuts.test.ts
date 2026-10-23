import { describe, expect, it } from 'vitest';
import { shortcutDialogFor, switcherOrder } from '../shortcuts';
import { ChannelCategory, type Channel } from '@shared/types';

const key = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', init);

const channel = (name: string, fields: Partial<Channel> = {}): Channel => ({
  name,
  category: name.startsWith('#') ? ChannelCategory.channel : ChannelCategory.priv,
  unReadMessages: 0,
  ...fields,
});

describe('shortcutDialogFor', () => {
  it.each([
    [{ key: 'k', ctrlKey: true }, 'switcher'],
    [{ key: 'k', metaKey: true }, 'switcher'],
    [{ key: 'K', ctrlKey: true }, 'switcher'],
    [{ key: '/', ctrlKey: true }, 'help'],
    [{ key: '/', metaKey: true, shiftKey: true }, 'help'],
  ])('should map %o to %s', (init, dialog) => {
    expect(shortcutDialogFor(key(init))).toBe(dialog);
  });

  it.each([
    { key: 'k' },
    { key: '/' },
    { key: 'k', ctrlKey: true, shiftKey: true },
    { key: 'k', ctrlKey: true, altKey: true },
    { key: 'j', ctrlKey: true },
  ])('should ignore %o', (init) => {
    expect(shortcutDialogFor(key(init))).toBeUndefined();
  });
});

describe('switcherOrder', () => {
  it('should put mentions first, then unread, then the rest, and the current window last', () => {
    const channels = [
      channel('#current', { unReadMessages: 3 }),
      channel('#quiet'),
      channel('#busy', { unReadMessages: 5 }),
      channel('friend', { unReadMessages: 1, hasMention: true }),
      channel('#later'),
    ];

    expect(switcherOrder(channels, '#Current').map(({ name }) => name)).toEqual(['friend', '#busy', '#quiet', '#later', '#current']);
  });

  it('should keep the sidebar order of the window groups', () => {
    const channels = [channel('#chan'), channel('Debug', { category: ChannelCategory.debug }), channel('peer'), channel('Status', { category: ChannelCategory.status })];

    expect(switcherOrder(channels, '#none').map(({ name }) => name)).toEqual(['Status', 'Debug', '#chan', 'peer']);
  });

  it('should not change the given list', () => {
    const channels = [channel('#a'), channel('#b', { unReadMessages: 1 })];

    switcherOrder(channels, '#a');

    expect(channels.map(({ name }) => name)).toEqual(['#a', '#b']);
  });

  it('should handle no windows', () => {
    expect(switcherOrder([], '#a')).toEqual([]);
  });
});
