import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InputContextMenu } from '@features/chat/components/InputContextMenu';
import { clipboard, isDesktop } from '@/runtime/desktop';

const readClipboard = (): Promise<string> => clipboard.readText();
const writeClipboard = (text: string): Promise<void> => clipboard.writeText(text);

// Our own copy/cut text, so Firefox can paste without readText()'s permission popup
let internalClipboard: string | null = null;

// Resolved at load so paste decisions are synchronous; desktop's clipboard plugin handles permissions itself
let canQueryClipboard = false;
if (!isDesktop()) {
  navigator.permissions?.query({ name: 'clipboard-read' as PermissionName })
    .then((perm) => { canQueryClipboard = perm.state !== 'denied'; })
    .catch(() => { /* stays false — Firefox */ });
}

/** Exported for tests */
export const _setInternalClipboard = (text: string | null): void => { internalClipboard = text; };
export const _getInternalClipboard = (): string | null => internalClipboard;
export const _setCanQueryClipboard = (value: boolean): void => { canQueryClipboard = value; };

const clipboardHasContent = async (): Promise<boolean> => {
  if (isDesktop()) {
    try {
      return (await readClipboard()).length > 0;
    } catch {
      // Tauri's readText() rejects on an empty or non-text clipboard.
      return false;
    }
  }
  if (canQueryClipboard) {
    try {
      return (await navigator.clipboard.readText()).length > 0;
    } catch {
      return false;
    }
  }
  // Firefox: probing the clipboard pops a permission prompt, so Paste stays enabled
  return true;
};

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
  const [canPaste, setCanPaste] = useState(true);
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // Taken before macOS auto-selects the input on right-click (Electron #46493)
  const savedSelectionRef = useRef<{
    el: HTMLInputElement | HTMLTextAreaElement;
    start: number;
    end: number;
  } | null>(null);

  const resolveSelection = (input: HTMLInputElement | HTMLTextAreaElement): { start: number; end: number } => {
    const saved = savedSelectionRef.current;
    if (saved && saved.el === input) {
      return { start: saved.start, end: saved.end };
    }
    return {
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? 0,
    };
  };

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

      const { start, end } = resolveSelection(target);
      setHasSelection(start !== end);
      setHasContent(target.value.length > 0);
      setAllSelected(start === 0 && end === target.value.length && target.value.length > 0);

      const position = { x: event.clientX, y: event.clientY };
      void clipboardHasContent().then((hasText) => {
        setCanPaste(hasText);
        setContextMenuPosition(position);
      });
    };

    const handleMouseDown = (event: MouseEvent): void => {
      if (event.button !== 2) { return; }
      const target = event.target;
      if (!isEditableElement(target)) { return; }
      savedSelectionRef.current = {
        el: target,
        start: target.selectionStart ?? target.value.length,
        end: target.selectionEnd ?? target.value.length,
      };
    };

    // Text copied in another app must not be shadowed by a stale internal buffer
    const handleWindowBlur = () => { internalClipboard = null; };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    globalThis.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
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
    const { start, end } = resolveSelection(input);
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
    const { start, end } = resolveSelection(input);
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
      const { start, end } = resolveSelection(input);
      input.focus();
      input.setSelectionRange(start, end);
      // Native-paste primitive: fires React's input event, keeps undo, survives the portal focus bounce on macOS
      const exec = (document as Document & { execCommand?: (cmd: string, ui: boolean, value: string) => boolean }).execCommand;
      if (typeof exec === 'function') {
        try {
          if (exec.call(document, 'insertText', false, clipText)) { return; }
        } catch { /* fall through to setNativeValue */ }
      }
      // execCommand is missing in jsdom and returns false in Firefox
      const newValue = input.value.substring(0, start) + clipText + input.value.substring(end);
      setNativeValue(input, newValue);
      const cursorPos = start + clipText.length;
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(cursorPos, cursorPos);
      });
    };
    if (isDesktop()) {
      readClipboard().then(doPaste).catch(showHint);
    } else if (canQueryClipboard) {
      // Chrome — readText() works with granted permission, no popup
      navigator.clipboard.readText().then(doPaste).catch(showHint);
    } else {
      // Firefox: internal buffer only; text copied elsewhere needs Ctrl+V
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
        canPaste={canPaste}
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
