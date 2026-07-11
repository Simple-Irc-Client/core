import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { globalIdbStorage } from '@shared/lib/idbStorage';
import type { UserScript, ScriptError } from '../types';

interface ScriptsStore {
  scripts: Record<string, UserScript>;
  /** Last runtime/eval error per script — not persisted */
  runtimeErrors: Record<string, ScriptError | undefined>;

  addScript: (name: string, source: string) => string;
  updateScript: (id: string, patch: Partial<Pick<UserScript, 'name' | 'source'>>) => void;
  deleteScript: (id: string) => void;
  setScriptEnabled: (id: string, enabled: boolean) => void;
  setRuntimeError: (id: string, error?: ScriptError) => void;
}

export const useScriptsStore = create<ScriptsStore>()(
  devtools(
    persist(
      (set) => ({
        scripts: {},
        runtimeErrors: {},

        addScript: (name: string, source: string): string => {
          const id = uuidv4();
          const now = new Date().toISOString();
          set((state) => ({
            scripts: { ...state.scripts, [id]: { id, name, source, enabled: false, createdAt: now, updatedAt: now } },
          }));
          return id;
        },
        updateScript: (id: string, patch: Partial<Pick<UserScript, 'name' | 'source'>>): void => {
          set((state) => {
            const existing = state.scripts[id];
            if (!existing) { return state; }
            return { scripts: { ...state.scripts, [id]: { ...existing, ...patch, updatedAt: new Date().toISOString() } } };
          });
        },
        deleteScript: (id: string): void => {
          set((state) => ({
            scripts: Object.fromEntries(Object.entries(state.scripts).filter(([key]) => key !== id)),
            runtimeErrors: Object.fromEntries(Object.entries(state.runtimeErrors).filter(([key]) => key !== id)),
          }));
        },
        setScriptEnabled: (id: string, enabled: boolean): void => {
          set((state) => {
            const existing = state.scripts[id];
            if (!existing) { return state; }
            return { scripts: { ...state.scripts, [id]: { ...existing, enabled } } };
          });
        },
        setRuntimeError: (id: string, error?: ScriptError): void => {
          set((state) => ({ runtimeErrors: { ...state.runtimeErrors, [id]: error } }));
        },
      }),
      {
        name: 'sic-scripts',
        version: 1,
        storage: createJSONStorage(() => globalIdbStorage),
        partialize: (state) => ({ scripts: state.scripts }) as unknown as ScriptsStore,
      },
    ),
  ),
);

export const getScripts = (): Record<string, UserScript> => useScriptsStore.getState().scripts;

export const getEnabledScripts = (): UserScript[] =>
  Object.values(useScriptsStore.getState().scripts).filter((script) => script.enabled);

export const addScript = (name: string, source: string): string => useScriptsStore.getState().addScript(name, source);

export const updateScript = (id: string, patch: Partial<Pick<UserScript, 'name' | 'source'>>): void => {
  useScriptsStore.getState().updateScript(id, patch);
};

export const deleteScript = (id: string): void => useScriptsStore.getState().deleteScript(id);

export const setScriptEnabled = (id: string, enabled: boolean): void => {
  useScriptsStore.getState().setScriptEnabled(id, enabled);
};

export const setRuntimeError = (id: string, error?: ScriptError): void => {
  useScriptsStore.getState().setRuntimeError(id, error);
};
