import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { GlobalInputContextMenu, handleNoContextMenu } from '../GlobalInputContextMenu';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('GlobalInputContextMenu', () => {
  let mockReadText: ReturnType<typeof vi.fn>;
  let mockWriteText: ReturnType<typeof vi.fn>;
  const originalRAF = globalThis.requestAnimationFrame;

  beforeEach(() => {
    mockReadText = vi.fn().mockResolvedValue('clipboard text');
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { readText: mockReadText, writeText: mockWriteText },
    });
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
  });

  const createInput = (value: string, selStart = 0, selEnd = 0): HTMLInputElement => {
    const input = document.createElement('input');
    input.value = value;
    document.body.appendChild(input);
    input.focus();
    input.setSelectionRange(selStart, selEnd);
    return input;
  };

  const createTextarea = (value: string, selStart = 0, selEnd = 0): HTMLTextAreaElement => {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(selStart, selEnd);
    return textarea;
  };

  const fireKeyDown = (key: string, opts: { ctrlKey?: boolean; metaKey?: boolean } = {}): void => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
    document.dispatchEvent(event);
  };

  describe('keyboard shortcuts', () => {
    it('should not handle shortcuts without modifier keys', () => {
      render(<GlobalInputContextMenu />);
      const input = createInput('hello');

      fireKeyDown('v');

      expect(mockReadText).not.toHaveBeenCalled();
      input.remove();
    });

    it('should not handle shortcuts when a non-input element is focused', () => {
      render(<GlobalInputContextMenu />);
      const div = document.createElement('div');
      document.body.appendChild(div);
      div.focus();

      fireKeyDown('v', { ctrlKey: true });

      expect(mockReadText).not.toHaveBeenCalled();
      div.remove();
    });

    it('should not handle unrelated Ctrl+key combos', () => {
      render(<GlobalInputContextMenu />);
      const input = createInput('hello');

      fireKeyDown('z', { ctrlKey: true });

      expect(mockWriteText).not.toHaveBeenCalled();
      expect(mockReadText).not.toHaveBeenCalled();
      input.remove();
    });

    describe('copy (Ctrl/Meta+C)', () => {
      it('should copy selected text with Ctrl+C', () => {
        render(<GlobalInputContextMenu />);
        const input = createInput('hello world', 0, 5);

        fireKeyDown('c', { ctrlKey: true });

        expect(mockWriteText).toHaveBeenCalledWith('hello');
        input.remove();
      });

      it('should copy selected text with Meta+C', () => {
        render(<GlobalInputContextMenu />);
        const input = createInput('hello', 0, 5);

        fireKeyDown('c', { metaKey: true });

        expect(mockWriteText).toHaveBeenCalledWith('hello');
        input.remove();
      });

      it('should not copy when no text is selected', () => {
        render(<GlobalInputContextMenu />);
        const input = createInput('hello', 3, 3);

        fireKeyDown('c', { ctrlKey: true });

        expect(mockWriteText).not.toHaveBeenCalled();
        input.remove();
      });
    });

    describe('cut (Ctrl/Meta+X)', () => {
      it('should cut selected text and dispatch input event', () => {
        render(<GlobalInputContextMenu />);
        const input = createInput('hello world', 0, 5);
        const inputSpy = vi.fn();
        input.addEventListener('input', inputSpy);

        fireKeyDown('x', { ctrlKey: true });

        expect(mockWriteText).toHaveBeenCalledWith('hello');
        expect(inputSpy).toHaveBeenCalled();
        input.remove();
      });

      it('should not cut when no text is selected', () => {
        render(<GlobalInputContextMenu />);
        const input = createInput('hello', 2, 2);

        fireKeyDown('x', { ctrlKey: true });

        expect(mockWriteText).not.toHaveBeenCalled();
        input.remove();
      });
    });

    describe('paste (Ctrl/Meta+V)', () => {
      it('should not intercept paste on web (lets browser handle it natively)', () => {
        render(<GlobalInputContextMenu />);
        const input = createInput('hello world', 5, 5);
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, cancelable: true });
        const preventSpy = vi.spyOn(event, 'preventDefault');

        document.dispatchEvent(event);

        expect(mockReadText).not.toHaveBeenCalled();
        expect(preventSpy).not.toHaveBeenCalled();
        input.remove();
      });
    });

    describe('select all (Ctrl/Meta+A)', () => {
      it('should select all text in input', () => {
        render(<GlobalInputContextMenu />);
        const input = createInput('some text');
        const selectSpy = vi.spyOn(input, 'select');

        fireKeyDown('a', { ctrlKey: true });

        expect(selectSpy).toHaveBeenCalled();
        input.remove();
      });
    });

    describe('textarea support', () => {
      it('should handle copy on textarea elements', () => {
        render(<GlobalInputContextMenu />);
        const textarea = createTextarea('test content', 0, 4);

        fireKeyDown('c', { ctrlKey: true });

        expect(mockWriteText).toHaveBeenCalledWith('test');
        textarea.remove();
      });
    });

    it('should clean up event listeners on unmount', () => {
      const { unmount } = render(<GlobalInputContextMenu />);
      const input = createInput('hello', 0, 5);

      unmount();
      fireKeyDown('c', { ctrlKey: true });

      expect(mockWriteText).not.toHaveBeenCalled();
      input.remove();
    });
  });

  describe('context menu', () => {
    const fireContextMenu = (target: HTMLElement, x = 100, y = 200): void => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      act(() => { target.dispatchEvent(event); });
    };

    it('should show custom menu on input right-click', () => {
      render(<GlobalInputContextMenu />);
      const input = createInput('hello world');

      fireContextMenu(input);

      expect(document.body.textContent).toContain('contextmenu.input.cut');
      expect(document.body.textContent).toContain('contextmenu.input.copy');
      expect(document.body.textContent).toContain('contextmenu.input.paste');
      expect(document.body.textContent).toContain('contextmenu.input.selectAll');
      input.remove();
    });

    it('should show custom menu on textarea right-click', () => {
      render(<GlobalInputContextMenu />);
      const textarea = createTextarea('hello');

      fireContextMenu(textarea);

      expect(document.body.textContent).toContain('contextmenu.input.cut');
      textarea.remove();
    });

    it('should not show menu on non-input right-click', () => {
      render(<GlobalInputContextMenu />);
      const div = document.createElement('div');
      document.body.appendChild(div);

      fireContextMenu(div);

      expect(document.body.textContent).not.toContain('contextmenu.input.cut');
      div.remove();
    });

    it('should prevent default on input right-click', () => {
      render(<GlobalInputContextMenu />);
      const input = createInput('hello');

      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 200 });
      act(() => { input.dispatchEvent(event); });

      expect(event.defaultPrevented).toBe(true);
      input.remove();
    });

    it('should set hasSelection when text is selected', () => {
      render(<GlobalInputContextMenu />);
      const input = createInput('hello world', 0, 5);

      fireContextMenu(input);

      const cutItem = document.body.querySelector('[role="menuitem"]');
      expect(cutItem).not.toHaveAttribute('aria-disabled');
      input.remove();
    });

    it('should disable cut/copy when no text is selected', () => {
      render(<GlobalInputContextMenu />);
      const input = createInput('hello', 3, 3);

      fireContextMenu(input);

      const menuItems = document.body.querySelectorAll('[role="menuitem"]');
      // Cut and Copy should be disabled
      expect(menuItems[0]).toHaveAttribute('aria-disabled');
      expect(menuItems[1]).toHaveAttribute('aria-disabled');
      input.remove();
    });

    it('should close menu when clicking outside', () => {
      render(<GlobalInputContextMenu />);
      const input = createInput('hello');

      fireContextMenu(input);
      expect(document.body.querySelector('[role="menu"]')).not.toBeNull();

      act(() => { document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
      expect(document.body.querySelector('[role="menu"]')).toBeNull();
      input.remove();
    });

    it('should clean up context menu listener on unmount', () => {
      const { unmount } = render(<GlobalInputContextMenu />);
      const input = createInput('hello');

      unmount();
      fireContextMenu(input);

      expect(document.body.textContent).not.toContain('contextmenu.input.cut');
      input.remove();
    });
  });

  describe('Unhappy paths', () => {
    const fireContextMenu = (target: HTMLElement, x = 100, y = 200): void => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      act(() => { target.dispatchEvent(event); });
    };

    it('should not show context menu for contentEditable div', () => {
      render(<GlobalInputContextMenu />);
      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      div.focus();

      fireContextMenu(div);

      expect(document.body.textContent).not.toContain('contextmenu.input.cut');
      div.remove();
    });

    it('should show only one menu on multiple rapid right-clicks', () => {
      render(<GlobalInputContextMenu />);
      const input = createInput('hello world', 0, 5);

      fireContextMenu(input, 100, 200);
      fireContextMenu(input, 150, 250);

      const menus = document.body.querySelectorAll('[role="menu"]');
      expect(menus).toHaveLength(1);
      input.remove();
    });

    it('should not invoke callback when clicking aria-disabled menu item', () => {
      render(<GlobalInputContextMenu />);
      // Create input with no selection so Cut/Copy are disabled
      const input = createInput('hello', 3, 3);

      fireContextMenu(input);

      const menuItems = document.body.querySelectorAll('[role="menuitem"]');
      // Cut should be disabled
      expect(menuItems[0]).toHaveAttribute('aria-disabled');
      const cutItem = menuItems[0];
      expect(cutItem).toBeDefined();
      if (cutItem) fireEvent.click(cutItem);

      // Clipboard write should not be called for disabled cut
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      input.remove();
    });
  });
});

describe('handleNoContextMenu', () => {
  it('should prevent default on all elements', () => {
    const event = {
      target: document.createElement('div'),
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    handleNoContextMenu(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should prevent default on input elements', () => {
    const event = {
      target: document.createElement('input'),
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    handleNoContextMenu(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should prevent default on textarea elements', () => {
    const event = {
      target: document.createElement('textarea'),
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    handleNoContextMenu(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });
});
