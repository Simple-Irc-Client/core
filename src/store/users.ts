import { create } from 'zustand';
import { type User } from '../types';
import { devtools, persist } from 'zustand/middleware';

export interface UsersStore {
  users: User[];

  setAddUser: (newUser: User) => void;
  setRemoveUser: (nick: string, channel: string) => void;
  setQuitUser: (nick: string) => void;
  setRenameUser: (from: string, to: string) => void;
  getUser: (nick: string) => User | undefined;
  getHasUser: (nick: string) => boolean;
  setJoinUser: (nick: string, channel: string) => void;
  getUsersFromChannelSortedByMode: (channel: string) => User[];
  getUsersFromChannelSortedByAZ: (channel: string) => User[];
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
        getUsersFromChannelSortedByMode: (channel: string): User[] => {
          return get()
            .users.filter((user: User) => user.channels.includes(channel))
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
        getUsersFromChannelSortedByAZ: (channel: string): User[] => {
          return get()
            .users.filter((user: User) => user.channels.includes(channel))
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
