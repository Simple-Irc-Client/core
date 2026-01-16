import { create } from 'zustand';
import { type UserMode, type Message, type User } from '../types';
import { devtools } from 'zustand/middleware';
import { getCurrentChannelName, getCurrentNick } from './settings';
import { useCurrentStore } from './current';
import { clearTyping, setAddMessage } from './channels';
import { calculateMaxPermission } from '../network/irc/helpers';

interface UsersStore {
  users: User[];

  setAddUser: (newUser: User) => void;
  setRemoveUser: (nick: string, channelName: string) => void;
  setQuitUser: (nick: string) => void;
  setRenameUser: (from: string, to: string) => void;
  setJoinUser: (nick: string, channelName: string) => void;
  setUserAvatar: (nick: string, avatar: string) => void;
  setUserColor: (nick: string, color: string) => void;
  setUpdateUserFlag: (nick: string, channelName: string, plusMinus: string, newFlag: string, serverModes: UserMode[]) => void;
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
  })),
);

export const setAddUser = (newUser: User): void => {
  if (getHasUser(newUser.nick)) {
    const channel = newUser.channels.shift();
    if (channel !== undefined) {
      setJoinUser(newUser.nick, channel.name);
    }
  } else {
    useUsersStore.getState().setAddUser(newUser);
  }

  const currentChannelName = getCurrentChannelName();

  if (newUser.channels.map((channel) => channel.name).includes(currentChannelName)) {
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

  if (channels.map((channel) => channel.name).includes(currentChannelName)) {
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

  if (channels.map((channel) => channel.name).includes(currentChannelName)) {
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
    .users.filter((user: User) => user.channels.map((channel) => channel.name).includes(channelName))
    .sort((a: User, b: User) => {
      if (a.channels.find((channel) => channel.name === channelName)?.maxPermission !== b.channels.find((channel) => channel.name === channelName)?.maxPermission) {
        if ((a.channels.find((channel) => channel.name === channelName)?.maxPermission ?? -1) < (b.channels.find((channel) => channel.name === channelName)?.maxPermission ?? -1)) {
          return 1;
        } else {
          return -1;
        }
      } else {
        if (a.nick.toLowerCase() > b.nick.toLowerCase()) {
          return 1;
        }
        if (a.nick.toLowerCase() < b.nick.toLowerCase()) {
          return -1;
        }
      }
      return 0;
    });
};

export const getUsersFromChannelSortedByAZ = (channelName: string): User[] => {
  return useUsersStore
    .getState()
    .users.filter((user: User) => user.channels.map((channel) => channel.name).includes(channelName))
    .sort((a: User, b: User) => {
      const A = a.nick.toLowerCase();
      const B = b.nick.toLowerCase();
      return A < B ? -1 : A > B ? 1 : 0;
    });
};

export const setUserAvatar = (nick: string, avatar: string): void => {
  useUsersStore.getState().setUserAvatar(nick, avatar);

  const channels = getUser(nick)?.channels ?? [];
  const currentChannelName = getCurrentChannelName();

  if (channels.map((channel) => channel.name).includes(currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const setUserColor = (nick: string, color: string): void => {
  useUsersStore.getState().setUserColor(nick, color);

  const channels = getUser(nick)?.channels ?? [];
  const currentChannelName = getCurrentChannelName();

  if (channels.map((channel) => channel.name).includes(currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(currentChannelName));
  }
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
