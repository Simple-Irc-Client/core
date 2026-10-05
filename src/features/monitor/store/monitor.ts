// https://ircv3.net/specs/extensions/monitor.html

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getCaseMapping } from '@features/settings/store/settings';
import { foldName } from '@shared/lib/caseMapping';

export interface MonitoredUser {
  nick: string;
  online: boolean;
  /** nick!user@host, when online */
  userString?: string;
  lastUpdate: number;
}

interface MonitorStore {
  monitoredUsers: Map<string, MonitoredUser>;

  addMonitoredNick: (nick: string) => void;
  /** Existing entries keep their status */
  addMonitoredNicks: (nicks: string[]) => void;
  removeMonitoredNick: (nick: string) => void;
  /** Keeps the known status, e.g. after NICK */
  renameMonitoredNick: (oldNick: string, newNick: string) => void;
  setOnlineStatus: (nick: string, online: boolean, userString?: string) => void;
  setMultipleOnline: (nicks: string[], userStrings?: string[]) => void;
  setMultipleOffline: (nicks: string[]) => void;
  clearAll: () => void;
}

/** Map key for a nick, folded per the server's CASEMAPPING */
export const monitorKey = (nick: string): string => foldName(nick, getCaseMapping());

export const useMonitorStore = create<MonitorStore>()(
  devtools((set) => ({
    monitoredUsers: new Map(),

    addMonitoredNick: (nick: string): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        if (!newMap.has(monitorKey(nick))) {
          newMap.set(monitorKey(nick), {
            nick,
            online: false,
            lastUpdate: Date.now(),
          });
        }
        return { monitoredUsers: newMap };
      });
    },

    addMonitoredNicks: (nicks: string[]): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        for (const nick of nicks) {
          if (!newMap.has(monitorKey(nick))) {
            newMap.set(monitorKey(nick), {
              nick,
              online: false,
              lastUpdate: Date.now(),
            });
          }
        }
        return { monitoredUsers: newMap };
      });
    },

    removeMonitoredNick: (nick: string): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        newMap.delete(monitorKey(nick));
        return { monitoredUsers: newMap };
      });
    },

    renameMonitoredNick: (oldNick: string, newNick: string): void => {
      set((state) => {
        const oldKey = monitorKey(oldNick);
        const existing = state.monitoredUsers.get(oldKey);
        if (!existing) {
          return state;
        }
        const newMap = new Map(state.monitoredUsers);
        newMap.delete(oldKey);
        newMap.set(monitorKey(newNick), { ...existing, nick: newNick, lastUpdate: Date.now() });
        return { monitoredUsers: newMap };
      });
    },

    setOnlineStatus: (nick: string, online: boolean, userString?: string): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        const existing = newMap.get(monitorKey(nick));
        if (existing) {
          newMap.set(monitorKey(nick), {
            ...existing,
            online,
            userString: online ? userString : undefined,
            lastUpdate: Date.now(),
          });
        } else {
          newMap.set(monitorKey(nick), {
            nick,
            online,
            userString: online ? userString : undefined,
            lastUpdate: Date.now(),
          });
        }
        return { monitoredUsers: newMap };
      });
    },

    setMultipleOnline: (nicks: string[], userStrings?: string[]): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        nicks.forEach((nick, index) => {
          const userString = userStrings?.[index];
          const existing = newMap.get(monitorKey(nick));
          if (existing) {
            newMap.set(monitorKey(nick), {
              ...existing,
              online: true,
              userString,
              lastUpdate: Date.now(),
            });
          } else {
            newMap.set(monitorKey(nick), {
              nick,
              online: true,
              userString,
              lastUpdate: Date.now(),
            });
          }
        });
        return { monitoredUsers: newMap };
      });
    },

    setMultipleOffline: (nicks: string[]): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        nicks.forEach((nick) => {
          const existing = newMap.get(monitorKey(nick));
          if (existing) {
            newMap.set(monitorKey(nick), {
              ...existing,
              online: false,
              userString: undefined,
              lastUpdate: Date.now(),
            });
          }
        });
        return { monitoredUsers: newMap };
      });
    },

    clearAll: (): void => {
      set(() => ({ monitoredUsers: new Map() }));
    },
  })),
);


export const addMonitoredNick = (nick: string): void => {
  useMonitorStore.getState().addMonitoredNick(nick);
};

export const addMonitoredNicks = (nicks: string[]): void => {
  useMonitorStore.getState().addMonitoredNicks(nicks);
};

export const removeMonitoredNick = (nick: string): void => {
  useMonitorStore.getState().removeMonitoredNick(nick);
};

export const renameMonitoredNick = (oldNick: string, newNick: string): void => {
  useMonitorStore.getState().renameMonitoredNick(oldNick, newNick);
};

export const setMonitorOnline = (nick: string, userString?: string): void => {
  useMonitorStore.getState().setOnlineStatus(nick, true, userString);
};

export const setMonitorOffline = (nick: string): void => {
  useMonitorStore.getState().setOnlineStatus(nick, false);
};

export const setMultipleMonitorOnline = (nicks: string[], userStrings?: string[]): void => {
  useMonitorStore.getState().setMultipleOnline(nicks, userStrings);
};

export const setMultipleMonitorOffline = (nicks: string[]): void => {
  useMonitorStore.getState().setMultipleOffline(nicks);
};

export const getMonitoredUsers = (): MonitoredUser[] => {
  return Array.from(useMonitorStore.getState().monitoredUsers.values());
};

export const getOnlineMonitoredUsers = (): MonitoredUser[] => {
  return getMonitoredUsers().filter((user) => user.online);
};

export const getOfflineMonitoredUsers = (): MonitoredUser[] => {
  return getMonitoredUsers().filter((user) => !user.online);
};

export const isNickMonitored = (nick: string): boolean => {
  return useMonitorStore.getState().monitoredUsers.has(monitorKey(nick));
};

export const isNickOnline = (nick: string): boolean => {
  return useMonitorStore.getState().monitoredUsers.get(monitorKey(nick))?.online ?? false;
};

export const clearMonitorList = (): void => {
  useMonitorStore.getState().clearAll();
};
