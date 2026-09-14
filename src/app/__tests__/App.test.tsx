import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import App from '../App';
import { useContextMenuActions } from '@/providers/ContextMenuContext';

// Regression coverage for a bug where right-clicking *inside* our own already-open
// context menu (e.g. a submenu trigger) fell through to the native OS/WebView
// context menu. Root cause: the app-wide contextmenu suppression lived on a <div>
// inside MainLayout, but <ContextMenu /> (the actual Radix DropdownMenu, portaled
// to document.body) was rendered as MainLayout's *sibling*, not its descendant.
// React bubbles synthetic events along the component tree, not the DOM tree, so a
// contextmenu event firing inside the open menu never reached that <div> and was
// never prevented. The fix moved the suppression to wrap the whole app, including
// <ContextMenu />. These tests render the real App tree (menu included) to pin
// that contract.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../i18n', () => ({}));
vi.mock('../Network', () => ({ Network: () => null }));
vi.mock('@features/themes/components/ThemeStyleInjector', () => ({ default: () => null }));

// Stands in for MainLayout: a real consumer of the context-menu-opening API,
// wired up the same way Chat.tsx/Users.tsx open the real menu, so the test opens
// the menu through the same path production code uses.
vi.mock('@/layouts/MainLayout', () => ({
  default: function MainLayoutStub() {
    const { handleContextMenuUserClick } = useContextMenuActions();
    return (
      <button
        data-testid="open-menu"
        onContextMenu={(event) => handleContextMenuUserClick(event, 'chat', '#test')}
      >
        open
      </button>
    );
  },
}));

describe('App context menu suppression', () => {
  it('prevents the native context menu when right-clicking inside the already-open custom menu', () => {
    render(<App />);

    fireEvent.contextMenu(document.body.querySelector('[data-testid="open-menu"]') as Element);

    const menuItem = document.body.querySelector('[role="menuitem"]');
    expect(menuItem).not.toBeNull();

    // fireEvent()'s return value is dispatchEvent()'s: false once something
    // along the bubble path called preventDefault().
    const notPrevented = fireEvent.contextMenu(menuItem as Element);
    expect(notPrevented).toBe(false);
  });

  it('still prevents the native context menu on the element that opened it', () => {
    render(<App />);

    const trigger = document.body.querySelector('[data-testid="open-menu"]') as Element;
    const notPrevented = fireEvent.contextMenu(trigger);
    expect(notPrevented).toBe(false);
  });
});
