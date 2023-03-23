import { create } from 'zustand';
import { type Message, type User } from '../types';
import { devtools, persist } from 'zustand/middleware';
import { getCurrentChannelName, getCurrentNick } from './settings';
import { useCurrentStore } from './current';
import { clearTyping, setAddMessage } from './channels';

interface UsersStore {
  users: User[];

  setAddUser: (newUser: User) => void;
  setRemoveUser: (nick: string, channelName: string) => void;
  setQuitUser: (nick: string) => void;
  setRenameUser: (from: string, to: string) => void;
  getUser: (nick: string) => User | undefined;
  getHasUser: (nick: string) => boolean;
  setJoinUser: (nick: string, channelName: string) => void;
  getUsersFromChannelSortedByMode: (channelName: string) => User[];
  getUsersFromChannelSortedByAZ: (channelName: string) => User[];
  setUserAvatar: (nick: string, avatar: string) => void;
  setUserColor: (nick: string, color: string) => void;
}

export const useUsersStore = create<UsersStore>()(
  devtools(
    persist(
      (set, get) => ({
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
                if (user.nick === nick) {
                  user.channels = user.channels.filter((channel) => channel !== channelName);
                }
                return user;
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
              if (user.nick === from) {
                user.nick = to;
              }
              return user;
            }),
          }));
        },
        getUser: (nick: string): User | undefined => {
          return get().users.find((user: User) => user.nick === nick);
        },
        getHasUser: (nick: string): boolean => {
          return get().users.find((user: User) => user.nick === nick) !== undefined;
        },
        setJoinUser: (nick: string, channel: string): void => {
          set((state) => ({
            users: state.users.map((user: User) => {
              if (user.nick === nick) {
                user.channels.push(channel);
              }
              return user;
            }),
          }));
        },
        getUsersFromChannelSortedByMode: (channelName: string): User[] => {
          return get()
            .users.filter((user: User) => user.channels.includes(channelName))
            .sort((a: User, b: User) => {
              if (a.maxMode !== b.maxMode) {
                if (a.maxMode < b.maxMode) {
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
        },
        getUsersFromChannelSortedByAZ: (channelName: string): User[] => {
          return get()
            .users.filter((user: User) => user.channels.includes(channelName))
            .sort((a: User, b: User) => {
              const A = a.nick.toLowerCase();
              const B = b.nick.toLowerCase();
              return A < B ? -1 : A > B ? 1 : 0;
            });
        },
        setUserAvatar: (nick: string, avatar: string): void => {
          set((state) => ({
            users: state.users.map((user: User) => {
              if (user.nick === nick) {
                user.avatar = avatar;
              }
              return user;
            }),
          }));
        },
        setUserColor: (nick: string, color: string): void => {
          set((state) => ({
            users: state.users.map((user: User) => {
              if (user.nick === nick) {
                user.color = color;
              }
              return user;
            }),
          }));
        },
      }),
      { name: 'users' }
    )
  )
);

export const setAddUser = (newUser: User): void => {
  if (getHasUser(newUser.nick)) {
    const channel = newUser.channels.shift();
    if (channel !== undefined) {
      setJoinUser(newUser.nick, channel);
    }
  } else {
    useUsersStore.getState().setAddUser(newUser);
  }

  const currentChannelName = getCurrentChannelName();

  if (newUser.channels.includes(currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(currentChannelName));
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
    useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(channelName));
  }
};

export const setQuitUser = (nick: string, message: Omit<Message, 'target'>): void => {
  const channels = useUsersStore.getState().getUser(nick)?.channels ?? [];
  const currentChannelName = getCurrentChannelName();

  for (const channel of channels) {
    setAddMessage({ ...message, target: channel });
    clearTyping(channel, nick);
  }

  useUsersStore.getState().setQuitUser(nick);

  if (channels.includes(currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const setRenameUser = (from: string, to: string): void => {
  useUsersStore.getState().setRenameUser(from, to);

  const channels = useUsersStore.getState().getUser(to)?.channels ?? [];

  for (const channel of channels) {
    clearTyping(channel, from);
  }

  const currentChannelName = getCurrentChannelName();

  if (channels.includes(currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const getUser = (nick: string): User | undefined => {
  return useUsersStore.getState().getUser(nick);
};

export const getUserChannels = (nick: string): string[] => {
  return useUsersStore.getState().getUser(nick)?.channels ?? [];
};

export const getHasUser = (nick: string): boolean => {
  return useUsersStore.getState().getHasUser(nick);
};

export const setJoinUser = (nick: string, channelName: string): void => {
  useUsersStore.getState().setJoinUser(nick, channelName);

  if (getCurrentChannelName() === channelName) {
    useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(channelName));
  }
};

export const getUsersFromChannelSortedByMode = (channel: string): User[] => {
  return useUsersStore.getState().getUsersFromChannelSortedByMode(channel);
};

export const getUsersFromChannelSortedByAZ = (channel: string): User[] => {
  return useUsersStore.getState().getUsersFromChannelSortedByAZ(channel);
};

export const setUserAvatar = (nick: string, avatar: string): void => {
  useUsersStore.getState().setUserAvatar(nick, avatar);

  const channels = useUsersStore.getState().getUser(nick)?.channels ?? [];
  const currentChannelName = getCurrentChannelName();

  if (channels.includes(currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(currentChannelName));
  }
};

export const setUserColor = (nick: string, color: string): void => {
  useUsersStore.getState().setUserColor(nick, color);

  const channels = useUsersStore.getState().getUser(nick)?.channels ?? [];
  const currentChannelName = getCurrentChannelName();

  if (channels.includes(currentChannelName)) {
    useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(currentChannelName));
  }
};
