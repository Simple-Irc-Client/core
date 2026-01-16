import React, { type FC, type PropsWithChildren, useMemo, useState, useCallback } from 'react';
import { type ContextMenuCategory, ContextMenuContext } from './ContextMenuContext';

export const ContextMenuProvider: FC<PropsWithChildren> = ({ children }) => {
  const [contextMenuAnchorElement, setContextMenuAnchorElement] = useState<HTMLElement | null>(null);
  const [contextMenuCategory, setContextMenuCategory] = useState<ContextMenuCategory | undefined>(undefined);
  const [contextMenuItem, setContextMenuItem] = useState<string | undefined>(undefined);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const handleContextMenuUserClick = useCallback((event: React.MouseEvent<HTMLElement>, category: ContextMenuCategory, item: string): void => {
    event.preventDefault();
    setContextMenuCategory(category);
    setContextMenuItem(item);
    setContextMenuAnchorElement(event.currentTarget);
    setContextMenuOpen(true);
  }, []);

  const handleContextMenuClose = useCallback((): void => {
    setContextMenuCategory(undefined);
    setContextMenuItem(undefined);
    setContextMenuAnchorElement(null);
    setContextMenuOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      contextMenuAnchorElement,
      contextMenuOpen,
      contextMenuCategory,
      contextMenuItem,
      handleContextMenuUserClick,
      handleContextMenuClose,
    }),
    [contextMenuAnchorElement, contextMenuOpen, contextMenuCategory, contextMenuItem, handleContextMenuUserClick, handleContextMenuClose],
  );

  return <ContextMenuContext.Provider value={value}>{children}</ContextMenuContext.Provider>;
};
