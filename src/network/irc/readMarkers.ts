// https://ircv3.net/specs/extensions/read-marker

import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { ircSendRawMessage } from '@/network/irc/network';
import { getCaseMapping, isSameName } from '@features/settings/store/settings';
import { foldName } from '@shared/lib/caseMapping';

// Messages keep arriving in the window being read; one marker covers a burst of them
const LIVE_MARK_DELAY_MS = 2000;

/** Up to when each window is read, as the server last told us or we last told it */
const markers = new Map<string, string>();
/** Server time of the newest message shown in each window: our own clock never goes into a marker */
const newestShown = new Map<string, string>();
let pending: { target: string; timer: ReturnType<typeof setTimeout> } | undefined;

const keyOf = (target: string): string => foldName(target, getCaseMapping());

const isNewer = (time: string, than: string | undefined): boolean => than === undefined || Date.parse(time) > Date.parse(than);

export const getReadMarker = (target: string): string | undefined => markers.get(keyOf(target));

/** The server's marker: it only moves forward, so it replaces ours */
export const setReadMarker = (target: string, time: string): void => {
  markers.set(keyOf(target), time);
};

export const noteShownMessage = (target: string, time: string): void => {
  const key = keyOf(target);
  if (isNewer(time, newestShown.get(key))) {
    newestShown.set(key, time);
  }
};

const sendReadMarker = (target: string): void => {
  const key = keyOf(target);
  const newest = newestShown.get(key);
  if (newest === undefined || !isNewer(newest, markers.get(key))) {
    return;
  }
  markers.set(key, newest);
  ircSendRawMessage(`MARKREAD ${target} timestamp=${newest}`);
};

const flushPending = (): void => {
  if (pending === undefined) {
    return;
  }
  clearTimeout(pending.timer);
  const { target } = pending;
  pending = undefined;
  sendReadMarker(target);
};

/** Everything shown in the window has been read */
export const markRead = (target: string): void => {
  if (!isCapabilityEnabled('draft/read-marker')) {
    return;
  }
  flushPending();
  sendReadMarker(target);
};

/** Like markRead, for a message that just arrived in the window being read */
export const markReadSoon = (target: string): void => {
  if (!isCapabilityEnabled('draft/read-marker') || (pending !== undefined && isSameName(pending.target, target))) {
    return;
  }
  flushPending();
  pending = { target, timer: setTimeout(flushPending, LIVE_MARK_DELAY_MS) };
};

export const clearReadMarkers = (): void => {
  if (pending !== undefined) {
    clearTimeout(pending.timer);
    pending = undefined;
  }
  markers.clear();
  newestShown.clear();
};
