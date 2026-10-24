// A taken nick is not fought over: the client waits for it to free up, and only the user may ask services to free it

import { ircSendCommand, ircSendRawMessage } from '@/network/irc/network';
import { subscribeNicks, unsubscribeNicks } from '@features/monitor/subscribe';
import { isFriend } from '@features/friends/friends';
import { getOpenDmNicks } from '@features/channels/store/channels';
import { getCurrentChannelName, getCurrentNick, getIsConnected, getMonitorLimit, getWantedNick, getWatchLimit, isSameName, setWantedNick } from '@features/settings/store/settings';

/** Underscores added to a taken nick before giving up */
const MAX_ALTERNATIVE_SUFFIX = 3;

// Without MONITOR or WATCH nothing says when services freed the nick; this is how long they usually take
const GHOST_SETTLE_MS = 2000;

/** The nick to register with: the one the user chose, if the last connection had to do without it */
export const registrationNick = (): string => getWantedNick() ?? getCurrentNick();

/** During registration `taken` was in use: remembers the nick the user wanted, and gives the next one to try, if any */
export const onNickTaken = (taken: string): string | undefined => {
  const wanted = getWantedNick() ?? taken;
  if (getWantedNick() === undefined) {
    setWantedNick(taken);
  }
  const suffix = taken.length - wanted.length;
  return suffix < MAX_ALTERNATIVE_SUFFIX && isSameName(taken.slice(0, wanted.length), wanted) ? `${taken}_` : undefined;
};

const isWaiting = (): boolean => {
  const wanted = getWantedNick();
  return wanted !== undefined && !isSameName(wanted, getCurrentNick());
};

const stopWatching = (nick: string): void => {
  const isWatchedAnyway = isFriend(nick) || getOpenDmNicks().some((open) => isSameName(open, nick));
  if (!isWatchedAnyway && getIsConnected()) {
    unsubscribeNicks([nick]);
  }
};

/** Once registered as `nick`: the wait is over when it is the wanted one */
export const onRegisteredAs = (nick: string): void => {
  const wanted = getWantedNick();
  if (wanted !== undefined && isSameName(wanted, nick)) {
    setWantedNick(undefined);
  }
};

/** At end of MOTD, when presence limits are known: watch the wanted nick for when it frees up */
export const watchWantedNick = (): void => {
  const wanted = getWantedNick();
  if (wanted !== undefined && isWaiting()) {
    subscribeNicks([wanted]);
  }
};

/** MONITOR or WATCH says these nicks are free */
export const onNicksOffline = (nicks: string[]): void => {
  const wanted = getWantedNick();
  if (wanted !== undefined && isWaiting() && nicks.some((nick) => isSameName(nick, wanted))) {
    ircSendRawMessage(`NICK ${wanted}`);
  }
};

/** Our own nick changed: back to the wanted one ends the wait */
export const onOwnNickChanged = (nick: string): void => {
  const wanted = getWantedNick();
  if (wanted !== undefined && isSameName(wanted, nick)) {
    setWantedNick(undefined);
    stopWatching(wanted);
  }
};

/** The user picked a nick of their own, or settled for the one they have: stop waiting */
export const forgetWantedNick = (): void => {
  const wanted = getWantedNick();
  if (wanted === undefined) {
    return;
  }
  setWantedNick(undefined);
  stopWatching(wanted);
};

/** The user asks services to free the nick; only a session logged in to its account may */
export const reclaimWantedNick = (): void => {
  const wanted = getWantedNick();
  if (wanted === undefined || !isWaiting()) {
    return;
  }
  ircSendCommand(`PRIVMSG NickServ :GHOST ${wanted}`, { window: getCurrentChannelName() });
  if (getMonitorLimit() === 0 && getWatchLimit() === 0) {
    setTimeout(() => {
      if (isWaiting()) {
        ircSendRawMessage(`NICK ${wanted}`);
      }
    }, GHOST_SETTLE_MS);
  }
};
