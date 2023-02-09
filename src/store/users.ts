import { create } from "zustand";
import { User } from "../types";
import { devtools, persist } from "zustand/middleware";

export interface UsersStore {
  users: User[];

  setAddUser: Function;
  //   setRemoveUser: Function;
  setQuitUser: Function;
  setRenameUser: Function;
  getUser: Function;
  getHasUser: Function;
  //   setJoinUser: Function;
  //   getUsersFromChannel: Function;
  //   setUserAvatar: Function;
}

export const useUsersStore = create<UsersStore>()(
  devtools(
    persist(
      (set, get) => ({
        users: [],

        setAddUser: (newUser: User): void =>
          set((state) => ({
            users: [...state.users, newUser],
          })),
        //   setRemoveUser
        setQuitUser: (nick: string): void =>
          set((state) => ({
            users: state.users.filter((user: User) => user.nick !== nick),
          })),
        setRenameUser: (from: string, to: string): void =>
          set((state) => ({
            users: state.users.map((user: User) => {
              if (user.nick === from) {
                user.nick = to;
              }
              return user;
            }),
          })),
        getUser: (nick: string): User | undefined => {
          return get().users.find((user: User) => user.nick === nick);
        },
        getHasUser: (nick: string): boolean => {
          return get().users.find((user: User) => user.nick === nick) !== undefined;
        },
      }),
      { name: "users" }
    )
  )
);
