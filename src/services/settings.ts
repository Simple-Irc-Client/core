import type { Server } from "../models/servers";
import { writable } from "svelte/store";
// import type {UserMode} from '../models/user';

export let creatorCompleted = false;
export const setCreatorCompleted = writable(false);
setCreatorCompleted.subscribe((value) => {
  creatorCompleted = value;
});

export let nick = "";
export const setNick = writable("");
setNick.subscribe((value) => {
  nick = value;
});

export let server: Server | undefined;
export const setServer = writable(undefined);
setServer.subscribe((value) => {
  server = value;
});

export let currentChannelName = "";
export const setCurrentChannelName = writable("");
setCurrentChannelName.subscribe((value) => {
  currentChannelName = value;
});

export const setPasswordRequired = writable(false);
export const channelsListFinished = writable(false);
export const namesXProtoEnabled = writable(false);

/**
 * PREFIX: Array(5)
 * 0: {symbol: "~", mode: "q"}
 * 1: {symbol: "&", mode: "a"}
 * 2: {symbol: "@", mode: "o"}
 * 3: {symbol: "%", mode: "h"}
 * 4: {symbol: "+", mode: "v"}
 */

// private usersPrefix: UserMode[] = []; // from raw 005 PREFIX
