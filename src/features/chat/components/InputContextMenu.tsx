import { useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
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
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const items = [
    { label: t('contextmenu.input.cut'), action: onCut, disabled: !hasSelection },
    { label: t('contextmenu.input.copy'), action: onCopy, disabled: !hasSelection },
    { label: t('contextmenu.input.paste'), action: onPaste, disabled: false },
    { label: t('contextmenu.input.selectAll'), action: onSelectAll, disabled: !hasContent || allSelected },
  ];

  const focusItem = useCallback((index: number) => {
    itemRefs.current[index]?.focus();
  }, []);

  useEffect(() => {
    if (contextMenuPosition === null) return;

    // Focus first non-disabled item on open
    const firstEnabled = items.findIndex((item) => !item.disabled);
    if (firstEnabled !== -1) {
      requestAnimationFrame(() => focusItem(firstEnabled));
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenuPosition, onClose]);

  if (contextMenuPosition === null) return null;

  const clamped = clampPosition(contextMenuPosition);

  const handle = (action: () => void) => () => {
    flushSync(() => onClose());
    action();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    const navigableIndices = items.map((_, i) => i).filter((i) => !items[i]?.disabled);
    if (navigableIndices.length === 0) return;

    const moveFocus = (targetIdx: number | undefined) => {
      if (targetIdx !== undefined) focusItem(targetIdx);
    };

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const currentPos = navigableIndices.indexOf(index);
        const nextPos = currentPos < navigableIndices.length - 1 ? currentPos + 1 : 0;
        moveFocus(navigableIndices[nextPos]);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const currentPos = navigableIndices.indexOf(index);
        const prevPos = currentPos > 0 ? currentPos - 1 : navigableIndices.length - 1;
        moveFocus(navigableIndices[prevPos]);
        break;
      }
      case 'Home':
        e.preventDefault();
        moveFocus(navigableIndices[0]);
        break;
      case 'End':
        e.preventDefault();
        moveFocus(navigableIndices[navigableIndices.length - 1]);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const item = items[index];
        if (item && !item.disabled) {
          handle(item.action)();
        }
        break;
      }
    }
  };

  const itemClass = (disabled: boolean) =>
    `px-3 py-1.5 text-sm rounded-sm cursor-default select-none outline-none ${
      disabled
        ? 'opacity-50 pointer-events-none'
        : 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
    }`;

  return (
    <div
      ref={menuRef}
      role="menu"
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[100] min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ left: `${clamped.x}px`, top: `${clamped.y}px` }}
    >
      {items.map((item, index) => (
        <div key={item.label}>
          {index === 3 && <div className="-mx-1 my-1 h-px bg-muted" />}
          <div
            ref={(el) => { itemRefs.current[index] = el; }}
            role="menuitem"
            tabIndex={item.disabled ? -1 : 0}
            aria-disabled={item.disabled || undefined}
            className={itemClass(item.disabled)}
            onClick={item.disabled ? undefined : handle(item.action)}
            onKeyDown={(e) => handleItemKeyDown(e, index)}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
};
