import { create } from 'zustand';
import { type UserMode, type Message, type User, ChannelCategory } from '@shared/types';
import { devtools } from 'zustand/middleware';
import { getCaseMapping, getCurrentChannelName, getCurrentNick, isSameName } from '@features/settings/store/settings';
import { useCurrentStore } from '@features/chat/store/current';
import { clearTyping, getChannel, setAddMessage } from '@features/channels/store/channels';
import { calculateMaxPermission } from '@/network/irc/helpers';
import { foldName, type CaseMapping } from '@shared/lib/caseMapping';

const MAX_USERS = 50_000;

/**
 * Nick -> user index, rebuilt whenever the store hands back a different `users`
 * array (zustand replaces it on every mutation) or the server changes its
 * CASEMAPPING. Looking a nick up by scanning and casefolding every user made
 * populating a busy channel quadratic: RPL_NAMREPLY asks "do we know this
 * nick?" once per nick, against a list that is growing by one each time.
 */
let indexedUsers: User[] | null = null;
let indexedMapping: CaseMapping | null = null;
let nickIndex = new Map<string, User>();

const getNickIndex = (): Map<string, User> => {
  const users = useUsersStore.getState().users;
  const mapping = getCaseMapping();

  if (users !== indexedUsers || mapping !== indexedMapping) {
    nickIndex = new Map<string, User>();
    for (const user of users) {
      const key = foldName(user.nick, mapping);
      // First wins, matching the `find()` this replaced
      if (!nickIndex.has(key)) {
        nickIndex.set(key, user);
      }
    }
    indexedUsers = users;
    indexedMapping = mapping;
  }

  return nickIndex;
};

/** Resolved once instead of per comparison — `localeCompare` reparses its options on every call */
const nickCollator = new Intl.Collator();

/** Buffer for metadata that arrives before JOIN (e.g. after QUIT+reconnect), keyed by folded nick */
export const pendingMetadata = new Map<string, Partial<User>>();

const metadataKey = (nick: string): string => foldName(nick, getCaseMapping());

/** One entry of a parsed RPL_NAMREPLY roster */
export interface NamesUser {
  nick: string;
  ident: string;
  hostname: string;
  flags: string[];
  maxPermission: number;
}

interface UsersStore {
  users: User[];

  setAddUser: (newUser: User) => void;
  /** A whole RPL_NAMREPLY roster applied in one update — see `setNamesUsers` */
  setNamesUsers: (channelName: string, entries: NamesUser[]) => void;
  setRemoveUser: (nick: string, channelName: string) => void;
  setQuitUser: (nick: string) => void;
  setRenameUser: (from: string, to: string) => void;
  setJoinUser: (nick: string, channelName: string, flags?: string[], maxPermission?: number) => void;
  /** IRCv3 METADATA */
  setUserAvatar: (nick: string, avatar: string | undefined) => void;
  /** IRCv3 METADATA */
  setUserColor: (nick: string, color: string | undefined) => void;
  /** IRCv3 account-notify / account-tag */
  setUserAccount: (nick: string, account: string | null) => void;
  /** IRCv3 away-notify */
  setUserAway: (nick: string, away: boolean, reason?: string) => void;
  setUserHost: (nick: string, ident: string, hostname: string) => void;
  /** IRCv3 extended-join / SETNAME */
  setUserRealname: (nick: string, realname: string) => void;
  /** IRCv3 METADATA */
  setUserDisplayName: (nick: string, displayName: string | undefined) => void;
  /** IRCv3 METADATA */
  setUserStatus: (nick: string, status: string | undefined) => void;
  /** IRCv3 METADATA */
  setUserHomepage: (nick: string, homepage: string | undefined) => void;
  /** IRCv3 METADATA / draft/bot tag / WHOIS 335 / user mode +B */
  setUserBot: (nick: string, bot: boolean) => void;
  setUpdateUserFlag: (nick: string, channelName: string, plusMinus: string, newFlag: string, serverModes: UserMode[]) => void;
  setClearAll: () => void;
}

export const useUsersStore = create<UsersStore>()(
  devtools((set) => ({
    users: [],

    setAddUser: (newUser: User): void => {
      set((state) => ({
        users: [...state.users, newUser],
      }));
    },
    setNamesUsers: (channelName: string, entries: NamesUser[]): void => {
      set((state) => {
        const mapping = getCaseMapping();
        const indexByNick = new Map<string, number>();
        state.users.forEach((user, index) => {
          const key = foldName(user.nick, mapping);
          if (!indexByNick.has(key)) {
            indexByNick.set(key, index);
          }
        });

        const users = [...state.users];
        let changed = false;

        for (const entry of entries) {
          const key = foldName(entry.nick, mapping);
          const index = indexByNick.get(key);

          if (index === undefined) {
            if (users.length >= MAX_USERS) {
              continue;
            }
            // Metadata that arrived before we knew the nick
            const buffered = pendingMetadata.get(key);
            if (buffered !== undefined) {
              pendingMetadata.delete(key);
            }
            indexByNick.set(key, users.length);
            users.push({
              nick: entry.nick,
              ident: entry.ident,
              hostname: entry.hostname,
              flags: [],
              channels: [{ name: channelName, flags: entry.flags, maxPermission: entry.maxPermission }],
              ...buffered,
            });
            changed = true;
            continue;
          }

          const user = users[index];
          if (user === undefined) {
            continue;
          }

          const existingChannel = user.channels.find((channel) => isSameName(channel.name, channelName));
          if (existingChannel === undefined) {
            users[index] = { ...user, channels: [...user.channels, { name: channelName, flags: entry.flags, maxPermission: entry.maxPermission }] };
            changed = true;
          } else if (entry.flags.length > 0) {
            users[index] = {
              ...user,
              channels: user.channels.map((channel) =>
                isSameName(channel.name, channelName) ? { ...channel, flags: entry.flags, maxPermission: entry.maxPermission } : channel,
              ),
            };
            changed = true;
          }
        }

        return changed ? { users } : state;
      });
    },
    setRemoveUser: (nick: string, channelName: string): void => {
      set((state) => ({
        users: state.users
          .map((user: User) => {
            if (!isSameName(user.nick, nick)) {
              return user;
            }
            return { ...user, channels: user.channels.filter((channel) => !isSameName(channel.name, channelName)) };
          })
          .filter((user) => user.channels.length !== 0),
      }));
    },
    setQuitUser: (nick: string): void => {
      set((state) => ({
        users: state.users.filter((user: User) => !isSameName(user.nick, nick)),
      }));
    },
    setRenameUser: (from: string, to: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, from)) {
            return user;
          }
          return { ...user, nick: to };
        }),
      }));
    },
    setJoinUser: (nick: string, channel: string, flags?: string[], maxPermission?: number): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick)) {
            return user;
          }
          const existingChannel = user.channels.find((c) => isSameName(c.name, channel));
          if (existingChannel) {
            // Update flags if provided (e.g. from NAMES response after JOIN)
            if (flags && flags.length > 0) {
              return {
                ...user,
                channels: user.channels.map((c) =>
                  isSameName(c.name, channel) ? { ...c, flags, maxPermission: maxPermission ?? c.maxPermission } : c,
                ),
              };
            }
            return user;
          }
          return { ...user, channels: [...user.channels, { name: channel, flags: flags ?? [], maxPermission: maxPermission ?? -1 }] };
        }),
      }));
    },
    setUserAvatar: (nick: string, avatar: string | undefined): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || user.avatar === avatar) {
            return user;
          }
          return { ...user, avatar };
        }),
      }));
    },
    setUserColor: (nick: string, color: string | undefined): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || user.color === color) {
            return user;
          }
          return { ...user, color };
        }),
      }));
    },
    setUserAccount: (nick: string, account: string | null): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || user.account === (account ?? undefined)) {
            return user;
          }
          return { ...user, account: account ?? undefined };
        }),
      }));
    },
    setUserAway: (nick: string, away: boolean, reason?: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || (user.away === away && user.awayReason === reason)) {
            return user;
          }
          return { ...user, away, awayReason: reason };
        }),
      }));
    },
    setUserHost: (nick: string, ident: string, hostname: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || (user.ident === ident && user.hostname === hostname)) {
            return user;
          }
          return { ...user, ident, hostname };
        }),
      }));
    },
    setUserRealname: (nick: string, realname: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || user.realname === realname) {
            return user;
          }
          return { ...user, realname };
        }),
      }));
    },
    setUserDisplayName: (nick: string, displayName: string | undefined): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || user.displayName === displayName) {
            return user;
          }
          return { ...user, displayName };
        }),
      }));
    },
    setUserStatus: (nick: string, status: string | undefined): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || user.status === status) {
            return user;
          }
          return { ...user, status };
        }),
      }));
    },
    setUserHomepage: (nick: string, homepage: string | undefined): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || user.homepage === homepage) {
            return user;
          }
          return { ...user, homepage };
        }),
      }));
    },
    setUserBot: (nick: string, bot: boolean): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick) || user.bot === bot) {
            return user;
          }
          return { ...user, bot };
        }),
      }));
    },
    setUpdateUserFlag: (nick: string, channelName: string, plusMinus: string, newFlag: string, serverModes: UserMode[]): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (!isSameName(user.nick, nick)) {
            return user;
          }
          return {
            ...user,
            channels: user.channels.map((channel) => {
              if (!isSameName(channel.name, channelName)) {
                return channel;
              }
              const flags = plusMinus === '+' ? [...channel.flags, newFlag] : channel.flags.filter((flag) => flag !== newFlag);
              return { ...channel, flags, maxPermission: calculateMaxPermission(flags, serverModes) };
            }),
          };
        }),
      }));
    },
    setClearAll: (): void => {
      set(() => ({
        users: [],
      }));
    },
  })),
);

export const setAddUser = (newUser: User): void => {
  if (getHasUser(newUser.nick)) {
    const channel = newUser.channels[0];
    if (channel !== undefined) {
      setJoinUser(newUser.nick, channel.name);
    }
  } else {
    if (useUsersStore.getState().users.length >= MAX_USERS) { return; }
    // Apply any buffered metadata that arrived before JOIN
    const buffered = pendingMetadata.get(metadataKey(newUser.nick));
    if (buffered) {
      useUsersStore.getState().setAddUser({ ...newUser, ...buffered });
      pendingMetadata.delete(metadataKey(newUser.nick));
    } else {
      useUsersStore.getState().setAddUser(newUser);
    }
  }

  syncCurrentChannelUsers(newUser.nick);
};

/**
 * Apply a whole RPL_NAMREPLY roster at once.
 *
 * Adding the nicks one by one copied the entire user array and re-sorted (and
 * re-rendered) the visible user list once per nick, so joining a busy channel
 * cost O(n²) — over a second of blocked main thread at 2000 users.
 */
export const setNamesUsers = (channelName: string, entries: NamesUser[]): void => {
  if (entries.length === 0) {
    return;
  }

  useUsersStore.getState().setNamesUsers(channelName, entries);

  const currentChannelName = getCurrentChannelName();
  const myNick = getCurrentNick();
  // A roster can also name the peer of an open DM window, whose participant list is derived from the same users
  const touchesCurrentPriv = isPrivChannel(currentChannelName)
    && entries.some((entry) => isSameName(entry.nick, currentChannelName) || isSameName(entry.nick, myNick));

  if (isSameName(currentChannelName, channelName) || touchesCurrentPriv) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

/**
 * A roster still being streamed, keyed by folded channel name so the closing
 * RPL_ENDOFNAMES finds it whatever casing the server echoes back.
 */
const namesBuffer = new Map<string, { channelName: string; entries: NamesUser[] }>();

/**
 * A server that never closes the roster must not strand it. Flushing early
 * costs one extra pass over the user list, which is far cheaper than never
 * showing the users at all.
 */
const MAX_BUFFERED_NAMES = 1000;

/**
 * Collect one RPL_NAMREPLY line.
 *
 * A roster arrives ~15 nicks at a time and is terminated by RPL_ENDOFNAMES.
 * Applying each line on its own re-indexes and re-copies the whole user list
 * per line, which stays quadratic across a big channel — 20 000 users cost
 * ~4.7 s that way. Holding the lines until the roster ends turns it into a
 * single pass.
 */
export const bufferNamesUsers = (channelName: string, entries: NamesUser[]): void => {
  if (entries.length === 0) {
    return;
  }

  const key = foldName(channelName, getCaseMapping());
  const buffered = namesBuffer.get(key);

  if (buffered === undefined) {
    namesBuffer.set(key, { channelName, entries: [...entries] });
  } else {
    for (const entry of entries) {
      buffered.entries.push(entry);
    }
  }

  if ((namesBuffer.get(key)?.entries.length ?? 0) >= MAX_BUFFERED_NAMES) {
    flushNamesUsers(channelName);
  }
};

/** Apply a collected roster — RPL_ENDOFNAMES, or the safety valve above */
export const flushNamesUsers = (channelName: string): void => {
  const key = foldName(channelName, getCaseMapping());
  const buffered = namesBuffer.get(key);

  if (buffered === undefined) {
    return;
  }

  namesBuffer.delete(key);
  // The name from the roster itself, not the one on the closing line
  setNamesUsers(buffered.channelName, buffered.entries);
};

export const setRemoveUser = (nick: string, channelName: string): void => {
  if (isSameName(nick, getCurrentNick())) {
    const usersFromChannel = getUsersFromChannelSortedByAZ(channelName);
    for (const userFromChannel of usersFromChannel) {
      useUsersStore.getState().setRemoveUser(userFromChannel.nick, channelName);
      clearTyping(channelName, userFromChannel.nick);
    }
  } else {
    useUsersStore.getState().setRemoveUser(nick, channelName);
    clearTyping(channelName, nick);
  }

  if (isSameName(getCurrentChannelName(), channelName)) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(channelName));
  }
};

export const setQuitUser = (nick: string, message: Omit<Message, 'target'>): void => {
  const channels = getUser(nick)?.channels ?? [];
  const currentChannelName = getCurrentChannelName();

  for (const channel of channels) {
    setAddMessage({ ...message, target: channel.name });
    clearTyping(channel.name, nick);
  }

  // An open DM window with the quitting user is not in their channel list - notify it too
  if (isPrivChannel(nick)) {
    setAddMessage({ ...message, target: nick });
    clearTyping(nick, nick);
  }

  useUsersStore.getState().setQuitUser(nick);

  if (channels.some((channel) => isSameName(channel.name, currentChannelName)) || (isPrivChannel(currentChannelName) && isSameName(nick, currentChannelName))) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const setRenameUser = (from: string, to: string): void => {
  useUsersStore.getState().setRenameUser(from, to);

  const channels = getUser(to)?.channels ?? [];

  for (const channel of channels) {
    clearTyping(channel.name, from);
  }

  const currentChannelName = getCurrentChannelName();
  const isCurrentPrivParticipant = isPrivChannel(currentChannelName) && (isSameName(from, currentChannelName) || isSameName(to, currentChannelName));

  if (channels.some((channel) => isSameName(channel.name, currentChannelName)) || isCurrentPrivParticipant) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const getUser = (nick: string): User | undefined => {
  return getNickIndex().get(foldName(nick, getCaseMapping()));
};

export const getUserChannels = (nick: string): string[] => {
  return getUser(nick)?.channels.map((channel) => channel.name) ?? [];
};

export const getHasUser = (nick: string): boolean => {
  return getUser(nick) !== undefined;
};

export const setJoinUser = (nick: string, channelName: string, flags?: string[], maxPermission?: number): void => {
  useUsersStore.getState().setJoinUser(nick, channelName, flags, maxPermission);

  if (isSameName(getCurrentChannelName(), channelName)) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(channelName));
  }
};

const isPrivChannel = (channelName: string): boolean => {
  return getChannel(channelName)?.category === ChannelCategory.priv;
};

const createStubUser = (nick: string): User => {
  return { nick, ident: '', hostname: '', flags: [], channels: [] };
};

/** A DM window always contains exactly the two participants: us and the peer the window is named after */
const getPrivParticipants = (privName: string): User[] => {
  const myNick = getCurrentNick();
  const nicks = isSameName(privName, myNick) ? [privName] : [myNick, privName];

  return nicks
    .filter((nick) => nick.length > 0)
    .map((nick) => getUser(nick) ?? createStubUser(nick))
    .sort((a: User, b: User) => a.nick.toLowerCase().localeCompare(b.nick.toLowerCase()));
};

export const getUsersFromChannelSortedByMode = (channelName: string): User[] => {
  if (isPrivChannel(channelName)) {
    return getPrivParticipants(channelName);
  }

  // The permission and the lowercased nick are read once per user rather than
  // twice per comparison — the comparator runs O(n log n) times, and each
  // `find()` walked the user's channel list casefolding names as it went
  const entries: { user: User; permission: number; sortKey: string }[] = [];

  for (const user of useUsersStore.getState().users) {
    const channel = user.channels.find((c) => isSameName(c.name, channelName));
    if (channel === undefined) {
      continue;
    }
    entries.push({ user, permission: channel.maxPermission ?? -1, sortKey: user.nick.toLowerCase() });
  }

  entries.sort((a, b) => (a.permission === b.permission ? nickCollator.compare(a.sortKey, b.sortKey) : b.permission - a.permission));

  return entries.map((entry) => entry.user);
};

export const getUsersFromChannelSortedByAZ = (channelName: string): User[] => {
  return useUsersStore
    .getState()
    .users.filter((user: User) => user.channels.some((channel) => isSameName(channel.name, channelName)))
    .sort((a: User, b: User) => {
      const A = a.nick.toLowerCase();
      const B = b.nick.toLowerCase();
      return A < B ? -1 : A > B ? 1 : 0;
    });
};

const syncCurrentChannelUsers = (nick: string): void => {
  const channels = getUser(nick)?.channels ?? [];
  const currentChannelName = getCurrentChannelName();
  const isCurrentPrivParticipant = isPrivChannel(currentChannelName) && (isSameName(nick, currentChannelName) || isSameName(nick, getCurrentNick()));

  if (channels.some((channel) => isSameName(channel.name, currentChannelName)) || isCurrentPrivParticipant) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

/** Buffer metadata for a user not yet in the store (arrives before JOIN) */
const bufferMetadata = (nick: string, data: Partial<User>): void => {
  const key = metadataKey(nick);
  const existing = pendingMetadata.get(key) ?? {};
  pendingMetadata.set(key, { ...existing, ...data });
};

export const setUserAvatar = (nick: string, avatar: string | undefined): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserAvatar(nick, avatar);
    syncCurrentChannelUsers(nick);
  } else {
    bufferMetadata(nick, { avatar });
  }
};

export const setUserColor = (nick: string, color: string | undefined): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserColor(nick, color);
    syncCurrentChannelUsers(nick);
  } else {
    bufferMetadata(nick, { color });
  }
};

export const setUserAccount = (nick: string, account: string | null): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserAccount(nick, account);
  } else {
    bufferMetadata(nick, { account: account ?? undefined });
  }
};

export const setUserAway = (nick: string, away: boolean, reason?: string): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserAway(nick, away, reason);
    syncCurrentChannelUsers(nick);
  } else {
    bufferMetadata(nick, { away, awayReason: reason });
  }
};

export const setUserHost = (nick: string, ident: string, hostname: string): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserHost(nick, ident, hostname);
    syncCurrentChannelUsers(nick);
  } else {
    bufferMetadata(nick, { ident, hostname });
  }
};

export const setUserRealname = (nick: string, realname: string): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserRealname(nick, realname);
  } else {
    bufferMetadata(nick, { realname });
  }
};

export const setUserDisplayName = (nick: string, displayName: string | undefined): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserDisplayName(nick, displayName);
    syncCurrentChannelUsers(nick);
  } else {
    bufferMetadata(nick, { displayName });
  }
};

export const setUserStatus = (nick: string, status: string | undefined): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserStatus(nick, status);
    syncCurrentChannelUsers(nick);
  } else {
    bufferMetadata(nick, { status });
  }
};

export const setUserHomepage = (nick: string, homepage: string | undefined): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserHomepage(nick, homepage);
  } else {
    bufferMetadata(nick, { homepage });
  }
};

export const setUserBot = (nick: string, bot: boolean): void => {
  if (getHasUser(nick)) {
    useUsersStore.getState().setUserBot(nick, bot);
    syncCurrentChannelUsers(nick);
  } else {
    bufferMetadata(nick, { bot });
  }
};

export const setUpdateUserFlag = (nick: string, channelName: string, plusMinus: string, newFlag: string, serverModes: UserMode[]): void => {
  useUsersStore.getState().setUpdateUserFlag(nick, channelName, plusMinus, newFlag, serverModes);

  const currentChannelName = getCurrentChannelName();

  if (isSameName(channelName, currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const getCurrentUserChannelModes = (channelName: string): string[] => {
  const currentNick = getCurrentNick();
  const user = getUser(currentNick);
  const channel = user?.channels.find((ch) => isSameName(ch.name, channelName));
  return channel?.flags ?? [];
};

export const setUsersClearAll = (): void => {
  pendingMetadata.clear();
  // A roster half-received when the connection dropped belongs to the old session
  namesBuffer.clear();
  useUsersStore.getState().setClearAll();
};
