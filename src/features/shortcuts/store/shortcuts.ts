import { create } from 'zustand';

export type ShortcutDialog = 'switcher' | 'help';

interface ShortcutsStore {
  openDialog: ShortcutDialog | null;
  setOpenDialog: (dialog: ShortcutDialog | null) => void;
}

export const useShortcutsStore = create<ShortcutsStore>()((set) => ({
  openDialog: null,
  setOpenDialog: (dialog: ShortcutDialog | null): void => {
    set(() => ({ openDialog: dialog }));
  },
}));

export const openShortcutsHelp = (): void => {
  useShortcutsStore.getState().setOpenDialog('help');
};
