import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InputContextMenu } from '@features/chat/components/InputContextMenu';

const sicDesktop = (globalThis as unknown as Record<string, Record<string, unknown>>).sicDesktop;
const desktopClipboard = sicDesktop?.clipboard as { readText: () => string; writeText: (text: string) => void } | undefined ?? null;

const readClipboard = (): Promise<string> =>
  desktopClipboard
    ? Promise.resolve().then(() => desktopClipboard.readText())
    : navigator.clipboard.readText();

const writeClipboard = (text: string): Promise<void> =>
  desktopClipboard
    ? Promise.resolve().then(() => { desktopClipboard.writeText(text); })
    : navigator.clipboard.writeText(text);

// Internal clipboard buffer — stores text from our own copy/cut operations
// so Firefox can paste without calling readText() (which triggers a popup).
let internalClipboard: string | null = null;

// Detect whether the browser supports clipboard-read permission (Chrome does,
// Firefox doesn't). Resolved once at module load so paste decisions are synchronous.
let canQueryClipboard = false;
if (!desktopClipboard) {
  navigator.permissions?.query({ name: 'clipboard-read' as PermissionName })
    .then((perm) => { canQueryClipboard = perm.state !== 'denied'; })
    .catch(() => { /* stays false — Firefox */ });
}

/** Exported for tests */
export const _setInternalClipboard = (text: string | null): void => { internalClipboard = text; };
export const _getInternalClipboard = (): string | null => internalClipboard;
export const _setCanQueryClipboard = (value: boolean): void => { canQueryClipboard = value; };

const isEditableElement = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement => {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
};

const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

export const handleNoContextMenu = (event: React.MouseEvent): void => {
  event.preventDefault();
};

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
const pasteShortcut = isMac ? '⌘V' : 'Ctrl+V';

const PasteHint = ({ position, onClose }: { position: { x: number; y: number }; onClose: () => void }) => {
  const { t } = useTranslation();
  useEffect(() => {
    const handleDismiss = () => onClose();
    document.addEventListener('mousedown', handleDismiss);
    document.addEventListener('keydown', handleDismiss);
    return () => {
      document.removeEventListener('mousedown', handleDismiss);
      document.removeEventListener('keydown', handleDismiss);
    };
  }, [onClose]);

  return (
    <div
      role="alert"
      className="fixed z-100 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {t('contextmenu.input.pasteHint', { shortcut: pasteShortcut })}
    </div>
  );
};

export const GlobalInputContextMenu = () => {
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [pasteHintPosition, setPasteHintPosition] = useState<{ x: number; y: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [allSelected, setAllSelected] = useState(false);
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) { return; }
      if (!isEditableElement(document.activeElement)) { return; }

      const input = document.activeElement;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;

      switch (event.key) {
        case 'c': {
          if (start !== end) {
            event.preventDefault();
            const text = input.value.substring(start, end);
            internalClipboard = text;
            writeClipboard(text).catch(() => { /* clipboard not available */ });
          }
          break;
        }
        case 'x': {
          if (start !== end) {
            event.preventDefault();
            const text = input.value.substring(start, end);
            internalClipboard = text;
            writeClipboard(text).catch(() => { /* clipboard not available */ });
            const newValue = input.value.substring(0, start) + input.value.substring(end);
            setNativeValue(input, newValue);
            requestAnimationFrame(() => input.setSelectionRange(start, start));
          }
          break;
        }
        case 'a': {
          event.preventDefault();
          input.select();
          break;
        }
      }
    };

    const handleContextMenu = (event: MouseEvent): void => {
      const target = event.target;
      if (!isEditableElement(target)) { return; }

      event.preventDefault();
      targetRef.current = target;

      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      setHasSelection(start !== end);
      setHasContent(target.value.length > 0);
      setAllSelected(start === 0 && end === target.value.length && target.value.length > 0);
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
    };

    // Clear internal clipboard buffer when the user switches away from the app.
    // If they copy text externally and come back, the stale buffer must not
    // shadow the system clipboard — show the keyboard-shortcut hint instead.
    const handleWindowBlur = () => { internalClipboard = null; };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    globalThis.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      globalThis.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const closeContextMenu = (): void => {
    setContextMenuPosition(null);
  };

  const cutSelection = (): void => {
    const input = targetRef.current;
    if (!input) { return; }
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if (start !== end) {
      const text = input.value.substring(start, end);
      internalClipboard = text;
      writeClipboard(text).catch(() => { /* clipboard not available */ });
      const newValue = input.value.substring(0, start) + input.value.substring(end);
      setNativeValue(input, newValue);
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(start, start);
      });
    }
  };

  const copySelection = (): void => {
    const input = targetRef.current;
    if (!input) { return; }
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if (start !== end) {
      const text = input.value.substring(start, end);
      internalClipboard = text;
      writeClipboard(text).catch(() => { /* clipboard not available */ });
      requestAnimationFrame(() => input.focus());
    }
  };

  const pasteFromClipboard = (): void => {
    const input = targetRef.current;
    if (!input) { return; }
    const pos = contextMenuPosition;
    input.focus();
    const showHint = () => {
      if (pos) {
        setPasteHintPosition(pos);
        setTimeout(() => setPasteHintPosition(null), 2000);
      }
    };
    const doPaste = (clipText: string) => {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const newValue = input.value.substring(0, start) + clipText + input.value.substring(end);
      setNativeValue(input, newValue);
      const cursorPos = start + clipText.length;
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(cursorPos, cursorPos);
      });
    };
    if (desktopClipboard) {
      if (isMac) {
        // On macOS Electron, the menu is hidden and paste role is unavailable.
        // Show a keyboard shortcut hint like Firefox does.
        showHint();
      } else {
        readClipboard().then(doPaste).catch(showHint);
      }
    } else if (canQueryClipboard) {
      // Chrome — readText() works with granted permission, no popup
      navigator.clipboard.readText().then(doPaste).catch(showHint);
    } else {
      // Firefox — readText() triggers an intrusive browser permission popup.
      // Use the internal buffer (populated by our own copy/cut) instead.
      // For text copied in external apps, only Ctrl+V works.
      if (internalClipboard !== null) {
        doPaste(internalClipboard);
      } else {
        showHint();
      }
    }
  };

  const selectAll = (): void => {
    const input = targetRef.current;
    if (!input) { return; }
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(0, input.value.length);
    });
  };

  return (
    <>
      <InputContextMenu
        contextMenuPosition={contextMenuPosition}
        hasSelection={hasSelection}
        hasContent={hasContent}
        allSelected={allSelected}
        onClose={closeContextMenu}
        onCut={cutSelection}
        onCopy={copySelection}
        onPaste={pasteFromClipboard}
        onSelectAll={selectAll}
      />
      {pasteHintPosition && (
        <PasteHint position={pasteHintPosition} onClose={() => setPasteHintPosition(null)} />
      )}
    </>
  );
};
