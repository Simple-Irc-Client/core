// https://ircv3.net/specs/extensions/pre-away

import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { ircSendCommand } from '@/network/irc/network';
import { getCurrentUserFlags, getIsConnected } from '@features/settings/store/settings';

/** Registered while nobody was looking: the server doesn't count this connection as the user being present */
let notPresent = false;

const isPageVisible = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';

/** Before CAP END: a connection opened in the background (a phone reconnecting) doesn't make the user present */
export const sendPreAway = (): void => {
  // A capability acknowledged after registration (cap-notify) ends with CAP END too
  if (getIsConnected()) {
    return;
  }
  notPresent = isCapabilityEnabled('draft/pre-away') && !isPageVisible();
  if (notPresent) {
    ircSendCommand('AWAY *', { automatic: true });
  }
};

/** Once the user is looking and the connection is up: present again, unless an away was set in the meantime */
export const announcePresence = (): void => {
  if (!notPresent || !isPageVisible() || !getIsConnected()) {
    return;
  }
  notPresent = false;
  if (!getCurrentUserFlags().includes('away')) {
    ircSendCommand('AWAY', { automatic: true });
  }
};

const onVisibilityChange = (): void => {
  announcePresence();
};

export const startPresenceWatch = (): void => {
  document.addEventListener('visibilitychange', onVisibilityChange);
};

export const stopPresenceWatch = (): void => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
};
