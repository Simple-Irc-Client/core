import { create } from 'zustand';
import { type UserMode, type Message, type User } from '@shared/types';
import { devtools } from 'zustand/middleware';
import { getCurrentChannelName, getCurrentNick } from '@features/settings/store/settings';
import { useCurrentStore } from '@features/chat/store/current';
import { clearTyping, setAddMessage } from '@features/channels/store/channels';
import { calculateMaxPermission } from '@/network/irc/helpers';

interface UsersStore {
  users: User[];

  setAddUser: (newUser: User) => void;
  setRemoveUser: (nick: string, channelName: string) => void;
  setQuitUser: (nick: string) => void;
  setRenameUser: (from: string, to: string) => void;
  setJoinUser: (nick: string, channelName: string) => void;
  /** IRCv3 METADATA */
  setUserAvatar: (nick: string, avatar: string) => void;
  /** IRCv3 METADATA */
  setUserColor: (nick: string, color: string) => void;
  /** IRCv3 account-notify / account-tag */
  setUserAccount: (nick: string, account: string | null) => void;
  /** IRCv3 away-notify */
  setUserAway: (nick: string, away: boolean, reason?: string) => void;
  setUserHost: (nick: string, ident: string, hostname: string) => void;
  /** IRCv3 extended-join / SETNAME */
  setUserRealname: (nick: string, realname: string) => void;
  /** IRCv3 METADATA */
  setUserDisplayName: (nick: string, displayName: string) => void;
  /** IRCv3 METADATA */
  setUserStatus: (nick: string, status: string | undefined) => void;
  /** IRCv3 METADATA */
  setUserHomepage: (nick: string, homepage: string | undefined) => void;
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
    setRemoveUser: (nick: string, channelName: string): void => {
      set((state) => ({
        users: state.users
          .map((user: User) => {
            if (user.nick !== nick) {
              return user;
            }
            return { ...user, channels: user.channels.filter((channel) => channel.name !== channelName) };
          })
          .filter((user) => user.channels.length !== 0),
      }));
    },
    setQuitUser: (nick: string): void => {
      set((state) => ({
        users: state.users.filter((user: User) => user.nick !== nick),
      }));
    },
    setRenameUser: (from: string, to: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== from) {
            return user;
          }
          return { ...user, nick: to };
        }),
      }));
    },
    setJoinUser: (nick: string, channel: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          // Prevent duplicate channel entries
          if (user.channels.some((c) => c.name === channel)) {
            return user;
          }
          return { ...user, channels: [...user.channels, { name: channel, flags: [], maxPermission: -1 }] };
        }),
      }));
    },
    setUserAvatar: (nick: string, avatar: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, avatar };
        }),
      }));
    },
    setUserColor: (nick: string, color: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, color };
        }),
      }));
    },
    setUserAccount: (nick: string, account: string | null): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, account: account ?? undefined };
        }),
      }));
    },
    setUserAway: (nick: string, away: boolean, reason?: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, away, awayReason: reason };
        }),
      }));
    },
    setUserHost: (nick: string, ident: string, hostname: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, ident, hostname };
        }),
      }));
    },
    setUserRealname: (nick: string, realname: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, realname };
        }),
      }));
    },
    setUserDisplayName: (nick: string, displayName: string): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, displayName };
        }),
      }));
    },
    setUserStatus: (nick: string, status: string | undefined): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, status };
        }),
      }));
    },
    setUserHomepage: (nick: string, homepage: string | undefined): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return { ...user, homepage };
        }),
      }));
    },
    setUpdateUserFlag: (nick: string, channelName: string, plusMinus: string, newFlag: string, serverModes: UserMode[]): void => {
      set((state) => ({
        users: state.users.map((user: User) => {
          if (user.nick !== nick) {
            return user;
          }
          return {
            ...user,
            channels: user.channels.map((channel) => {
              if (channel.name !== channelName) {
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
    useUsersStore.getState().setAddUser(newUser);
  }

  const currentChannelName = getCurrentChannelName();

  if (newUser.channels.some((channel) => channel.name === currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const setRemoveUser = (nick: string, channelName: string): void => {
  if (nick === getCurrentNick()) {
    const usersFromChannel = getUsersFromChannelSortedByAZ(channelName);
    for (const userFromChannel of usersFromChannel) {
      useUsersStore.getState().setRemoveUser(userFromChannel.nick, channelName);
    }
  }

  useUsersStore.getState().setRemoveUser(nick, channelName);
  clearTyping(channelName, nick);

  if (getCurrentChannelName() === channelName && nick !== getCurrentNick()) {
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

  useUsersStore.getState().setQuitUser(nick);

  if (channels.some((channel) => channel.name === currentChannelName)) {
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

  if (channels.some((channel) => channel.name === currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const getUser = (nick: string): User | undefined => {
  return useUsersStore.getState().users.find((user: User) => user.nick === nick);
};

export const getUserChannels = (nick: string): string[] => {
  return getUser(nick)?.channels.map((channel) => channel.name) ?? [];
};

export const getHasUser = (nick: string): boolean => {
  return getUser(nick) !== undefined;
};

export const setJoinUser = (nick: string, channelName: string): void => {
  useUsersStore.getState().setJoinUser(nick, channelName);

  if (getCurrentChannelName() === channelName) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(channelName));
  }
};

export const getUsersFromChannelSortedByMode = (channelName: string): User[] => {
  return useUsersStore
    .getState()
    .users.filter((user: User) => user.channels.some((channel) => channel.name === channelName))
    .sort((a: User, b: User) => {
      const aPermission = a.channels.find((c) => c.name === channelName)?.maxPermission ?? -1;
      const bPermission = b.channels.find((c) => c.name === channelName)?.maxPermission ?? -1;

      if (aPermission !== bPermission) {
        return bPermission - aPermission;
      }

      return a.nick.toLowerCase().localeCompare(b.nick.toLowerCase());
    });
};

export const getUsersFromChannelSortedByAZ = (channelName: string): User[] => {
  return useUsersStore
    .getState()
    .users.filter((user: User) => user.channels.some((channel) => channel.name === channelName))
    .sort((a: User, b: User) => {
      const A = a.nick.toLowerCase();
      const B = b.nick.toLowerCase();
      return A < B ? -1 : A > B ? 1 : 0;
    });
};

const syncCurrentChannelUsers = (nick: string): void => {
  const channels = getUser(nick)?.channels ?? [];
  const currentChannelName = getCurrentChannelName();

  if (channels.some((channel) => channel.name === currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const setUserAvatar = (nick: string, avatar: string): void => {
  useUsersStore.getState().setUserAvatar(nick, avatar);
  syncCurrentChannelUsers(nick);
};

export const setUserColor = (nick: string, color: string): void => {
  useUsersStore.getState().setUserColor(nick, color);
  syncCurrentChannelUsers(nick);
};

export const setUserAccount = (nick: string, account: string | null): void => {
  useUsersStore.getState().setUserAccount(nick, account);
};

export const setUserAway = (nick: string, away: boolean, reason?: string): void => {
  useUsersStore.getState().setUserAway(nick, away, reason);
  syncCurrentChannelUsers(nick);
};

export const setUserHost = (nick: string, ident: string, hostname: string): void => {
  useUsersStore.getState().setUserHost(nick, ident, hostname);
  syncCurrentChannelUsers(nick);
};

export const setUserRealname = (nick: string, realname: string): void => {
  useUsersStore.getState().setUserRealname(nick, realname);
};

export const setUserDisplayName = (nick: string, displayName: string): void => {
  useUsersStore.getState().setUserDisplayName(nick, displayName);
  syncCurrentChannelUsers(nick);
};

export const setUserStatus = (nick: string, status: string | undefined): void => {
  useUsersStore.getState().setUserStatus(nick, status);
  syncCurrentChannelUsers(nick);
};

export const setUserHomepage = (nick: string, homepage: string | undefined): void => {
  useUsersStore.getState().setUserHomepage(nick, homepage);
};

export const setUpdateUserFlag = (nick: string, channelName: string, plusMinus: string, newFlag: string, serverModes: UserMode[]): void => {
  useUsersStore.getState().setUpdateUserFlag(nick, channelName, plusMinus, newFlag, serverModes);

  const currentChannelName = getCurrentChannelName();

  if (channelName === currentChannelName) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const getCurrentUserChannelModes = (channelName: string): string[] => {
  const currentNick = getCurrentNick();
  const user = getUser(currentNick);
  const channel = user?.channels.find((ch) => ch.name === channelName);
  return channel?.flags ?? [];
};

export const setUsersClearAll = (): void => {
  useUsersStore.getState().setClearAll();
};
