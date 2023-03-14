import React, { type FC, type PropsWithChildren, useMemo, useRef, useState, useCallback } from 'react';
import { type ContextMenuCategory, ContextMenuContext } from './ContextMenuContext';

export const ContextMenuProvider: FC<PropsWithChildren> = ({ children }) => {
  const contextMenuAnchorElement = useRef<HTMLElement | null>(null);
  const contextMenuCategory = useRef<ContextMenuCategory | undefined>(undefined);
  const contextMenuItem = useRef<string | undefined>(undefined);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const handleContextMenuUserClick = useCallback((event: React.MouseEvent<HTMLElement>, category: ContextMenuCategory, item: string): void => {
    event.preventDefault();
    contextMenuCategory.current = category;
    contextMenuItem.current = item;
    contextMenuAnchorElement.current = event.currentTarget;
    setContextMenuOpen(true);
  }, []);

  const handleContextMenuClose = useCallback((): void => {
    contextMenuCategory.current = undefined;
    contextMenuItem.current = undefined;
    contextMenuAnchorElement.current = null;
    setContextMenuOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      contextMenuAnchorElement: contextMenuAnchorElement.current,
      contextMenuOpen,
      contextMenuCategory: contextMenuCategory.current,
      contextMenuItem: contextMenuItem.current,
      handleContextMenuUserClick,
      handleContextMenuClose,
    }),
    [contextMenuOpen]
  );

  return <ContextMenuContext.Provider value={value}>{children}</ContextMenuContext.Provider>;
};
