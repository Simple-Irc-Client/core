import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const MENU_HEIGHT = 160;
const MENU_WIDTH = 160;

const clampPosition = (position: { x: number; y: number }): { x: number; y: number } => {
  const x = Math.min(position.x, window.innerWidth - MENU_WIDTH);
  const y = position.y > window.innerHeight - MENU_HEIGHT
    ? position.y - MENU_HEIGHT
    : position.y;
  return { x: Math.max(0, x), y: Math.max(0, y) };
};

interface InputContextMenuProps {
  contextMenuPosition: { x: number; y: number } | null;
  hasSelection: boolean;
  hasContent: boolean;
  allSelected: boolean;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
}

export const InputContextMenu = ({ contextMenuPosition, hasSelection, hasContent, allSelected, onClose, onCut, onCopy, onPaste, onSelectAll }: InputContextMenuProps) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contextMenuPosition === null) return;
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuPosition, onClose]);

  if (contextMenuPosition === null) return null;

  const clamped = clampPosition(contextMenuPosition);

  const handle = (action: () => void) => () => {
    action();
    onClose();
  };

  const itemClass = (disabled: boolean) =>
    `px-3 py-1.5 text-sm rounded-sm cursor-default select-none ${
      disabled
        ? 'opacity-50 pointer-events-none'
        : 'hover:bg-accent hover:text-accent-foreground'
    }`;

  return (
    <div
      ref={menuRef}
      role="menu"
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[100] min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ left: `${clamped.x}px`, top: `${clamped.y}px` }}
    >
      <div role="menuitem" data-disabled={!hasSelection || undefined} className={itemClass(!hasSelection)} onClick={handle(onCut)}>{t('contextmenu.input.cut')}</div>
      <div role="menuitem" data-disabled={!hasSelection || undefined} className={itemClass(!hasSelection)} onClick={handle(onCopy)}>{t('contextmenu.input.copy')}</div>
      <div role="menuitem" className={itemClass(false)} onClick={handle(onPaste)}>{t('contextmenu.input.paste')}</div>
      <div className="-mx-1 my-1 h-px bg-muted" />
      <div role="menuitem" data-disabled={!hasContent || allSelected || undefined} className={itemClass(!hasContent || allSelected)} onClick={handle(onSelectAll)}>{t('contextmenu.input.selectAll')}</div>
    </div>
  );
};
