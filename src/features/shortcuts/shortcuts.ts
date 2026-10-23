import { CHANNEL_CATEGORY_ORDER } from '@features/channels/store/channels';
import { isSameName } from '@features/settings/store/settings';
import { isMac } from '@shared/lib/platform';
import { type Channel } from '@shared/types';
import { type ShortcutDialog } from './store/shortcuts';

export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

/** Ctrl+K / ⌘K opens the switcher, Ctrl+/ / ⌘/ the shortcuts list */
export const shortcutDialogFor = (event: KeyboardEvent): ShortcutDialog | undefined => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return undefined;
  }
  if (event.key.toLowerCase() === 'k' && !event.shiftKey) {
    return 'switcher';
  }
  // Shift is allowed: layouts like German type `/` with it
  if (event.key === '/') {
    return 'help';
  }
  return undefined;
};

const switcherRank = (channel: Channel, currentChannelName: string): number => {
  if (isSameName(channel.name, currentChannelName)) {
    return 3;
  }
  if (channel.hasMention === true) {
    return 0;
  }
  return channel.unReadMessages > 0 ? 1 : 2;
};

/** Mentions first, then unread, then the rest; the current window last; within each, the sidebar's order */
export const switcherOrder = (channels: Channel[], currentChannelName: string): Channel[] =>
  [...channels].sort(
    (a, b) =>
      switcherRank(a, currentChannelName) - switcherRank(b, currentChannelName) ||
      CHANNEL_CATEGORY_ORDER.indexOf(a.category) - CHANNEL_CATEGORY_ORDER.indexOf(b.category),
  );
