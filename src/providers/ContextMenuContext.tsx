import { createContext, useContext } from 'react';

export type ContextMenuCategory = 'user' | 'channel' | 'url' | 'text' | 'chat' | '';

export interface ContextMenuContextProps {
  contextMenuAnchorElement: HTMLElement | null;
  contextMenuOpen: boolean;
  contextMenuCategory: ContextMenuCategory | undefined;
  contextMenuItem: string | undefined;
  contextMenuPosition: { x: number; y: number } | null;
  handleContextMenuUserClick: (event: React.MouseEvent<HTMLElement>, category: ContextMenuCategory, item: string) => void;
  handleContextMenuClose: () => void;
}

export const ContextMenuContext = createContext<ContextMenuContextProps>({
  contextMenuAnchorElement: null,
  contextMenuOpen: false,
  contextMenuCategory: undefined,
  contextMenuItem: undefined,
  contextMenuPosition: null,
  handleContextMenuUserClick: function (): void {
    throw new Error('Function not implemented.');
  },
  handleContextMenuClose: function (): void {
    throw new Error('Function not implemented.');
  },
});

/** A never-changing context, so consumers like chat messages aren't re-rendered on every menu change. */
export type ContextMenuActions = Pick<ContextMenuContextProps, 'handleContextMenuUserClick' | 'handleContextMenuClose'>;

export const ContextMenuActionsContext = createContext<ContextMenuActions>({
  handleContextMenuUserClick: function (): void {
    throw new Error('Function not implemented.');
  },
  handleContextMenuClose: function (): void {
    throw new Error('Function not implemented.');
  },
});

export const useContextMenuActions = (): ContextMenuActions => useContext(ContextMenuActionsContext);

export const useContextMenu = (): ContextMenuContextProps => {
  const context = useContext(ContextMenuContext);

  if (context === null) {
    throw new Error(`"ContextMenuProvider" must be present in the DOM tree`);
  }

  return context;
};
