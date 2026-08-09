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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleContextMenuUserClick: function (_event: React.MouseEvent<HTMLElement>, _category: ContextMenuCategory, _item: string): void {
    throw new Error('Function not implemented.');
  },
  handleContextMenuClose: function (): void {
    throw new Error('Function not implemented.');
  },
});

/**
 * The handlers alone, on a context whose value never changes.
 *
 * The full context value changes every time the menu opens, moves or closes,
 * which re-renders every consumer — including all ~300 rendered chat messages,
 * each of which only ever needed to open the menu. Consumers that touch no menu
 * state should subscribe here so `memo` can hold.
 */
export type ContextMenuActions = Pick<ContextMenuContextProps, 'handleContextMenuUserClick' | 'handleContextMenuClose'>;

export const ContextMenuActionsContext = createContext<ContextMenuActions>({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleContextMenuUserClick: function (_event: React.MouseEvent<HTMLElement>, _category: ContextMenuCategory, _item: string): void {
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
