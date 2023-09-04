import { createContext, useContext } from 'react';

export type ContextMenuCategory = 'user' | 'channel' | 'url' | '';

export interface ContextMenuContextProps {
  contextMenuAnchorElement: HTMLElement | null;
  contextMenuOpen: boolean;
  contextMenuCategory: ContextMenuCategory | undefined;
  contextMenuItem: string | undefined;
  handleContextMenuUserClick: (event: React.MouseEvent<HTMLElement>, category: ContextMenuCategory, item: string) => void;
  handleContextMenuClose: () => void;
}

export const ContextMenuContext = createContext<ContextMenuContextProps>({
  contextMenuAnchorElement: null,
  contextMenuOpen: false,
  contextMenuCategory: undefined,
  contextMenuItem: undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleContextMenuUserClick: function (_event: React.MouseEvent<HTMLElement>, _category: ContextMenuCategory, _item: string): void {
    throw new Error('Function not implemented.');
  },
  handleContextMenuClose: function (): void {
    throw new Error('Function not implemented.');
  },
});

export const useContextMenu = (): ContextMenuContextProps => {
  const context = useContext(ContextMenuContext);

  if (context === null) {
    throw new Error(`"ContextMenuProvider" must be present in the DOM tree`);
  }

  return context;
};
