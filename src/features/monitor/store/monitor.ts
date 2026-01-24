/**
 * IRCv3 MONITOR Store
 * https://ircv3.net/specs/extensions/monitor.html
 *
 * MONITOR allows clients to track the online status of other users
 * without the overhead of ISON polling.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface MonitoredUser {
  nick: string;
  online: boolean;
  /** Full user string when online (nick!user@host) */
  userString?: string;
  /** Last time status changed */
  lastUpdate: number;
}

interface MonitorStore {
  /** Users being monitored */
  monitoredUsers: Map<string, MonitoredUser>;

  /** Add nick to monitor list */
  addMonitoredNick: (nick: string) => void;
  /** Remove nick from monitor list */
  removeMonitoredNick: (nick: string) => void;
  /** Set online status of a monitored nick */
  setOnlineStatus: (nick: string, online: boolean, userString?: string) => void;
  /** Set multiple nicks online at once */
  setMultipleOnline: (nicks: string[], userStrings?: string[]) => void;
  /** Set multiple nicks offline at once */
  setMultipleOffline: (nicks: string[]) => void;
  /** Clear all monitored users */
  clearAll: () => void;
}

export const useMonitorStore = create<MonitorStore>()(
  devtools((set) => ({
    monitoredUsers: new Map(),

    addMonitoredNick: (nick: string): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        if (!newMap.has(nick.toLowerCase())) {
          newMap.set(nick.toLowerCase(), {
            nick,
            online: false,
            lastUpdate: Date.now(),
          });
        }
        return { monitoredUsers: newMap };
      });
    },

    removeMonitoredNick: (nick: string): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        newMap.delete(nick.toLowerCase());
        return { monitoredUsers: newMap };
      });
    },

    setOnlineStatus: (nick: string, online: boolean, userString?: string): void => {
      set((state) => {
        const newMap = new Map(state.monitoredUsers);
        const existing = newMap.get(nick.toLowerCase());
        if (existing) {
          newMap.set(nick.toLowerCase(), {
            ...existing,
            online,
            userString: online ? userString : undefined,
            lastUpdate: Date.now(),
          });
        } else {
          // Add if not exists
          newMap.set(nick.toLowerCase(), {
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
          const existing = newMap.get(nick.toLowerCase());
          if (existing) {
            newMap.set(nick.toLowerCase(), {
              ...existing,
              online: true,
              userString,
              lastUpdate: Date.now(),
            });
          } else {
            newMap.set(nick.toLowerCase(), {
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
          const existing = newMap.get(nick.toLowerCase());
          if (existing) {
            newMap.set(nick.toLowerCase(), {
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

// Helper functions for external use

export const addMonitoredNick = (nick: string): void => {
  useMonitorStore.getState().addMonitoredNick(nick);
};

export const removeMonitoredNick = (nick: string): void => {
  useMonitorStore.getState().removeMonitoredNick(nick);
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
  return useMonitorStore.getState().monitoredUsers.has(nick.toLowerCase());
};

export const isNickOnline = (nick: string): boolean => {
  return useMonitorStore.getState().monitoredUsers.get(nick.toLowerCase())?.online ?? false;
};

export const clearMonitorList = (): void => {
  useMonitorStore.getState().clearAll();
};
