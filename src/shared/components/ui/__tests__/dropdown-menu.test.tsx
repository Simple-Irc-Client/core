import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { useState } from 'react';
import * as Sentry from '@sentry/react';
vi.mock('@sentry/react', () => ({ addBreadcrumb: vi.fn(), captureMessage: vi.fn() }));

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from '../dropdown-menu';

// Regression coverage for the macOS/WKWebView bug where a submenu opens and
// then silently closes ~1s later on its own: Radix's internal hover-intent
// timer relies on a continuous pointermove/pointerleave stream that WebKit
// can stop delivering, so it fires a close request even though the cursor
// never left the trigger/content. Our DropdownMenuSub wrapper vetoes that
// close whenever the (event-independent) `:hover` hit-test still says the
// pointer is over the submenu, and drives the real close itself via a
// debounced mouseleave check instead.
//
// Assertions go through `onOpenChange` rather than checking whether the
// submenu content is still in the DOM: Radix's SubContent stays mounted in
// jsdom while its (nonexistent) exit animation never fires, so a DOM-presence
// assertion can't distinguish "still open" from "closed but not yet unmounted".
describe('DropdownMenuSub hover-close guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderMenu = (onOpenChange: (open: boolean) => void) =>
    render(
      <DropdownMenu open>
        <DropdownMenuContent>
          <DropdownMenuSub onOpenChange={onOpenChange}>
            <DropdownMenuSubTrigger>Operator</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Kick</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

  it('does not report a close while the pointer is still hovering the submenu', () => {
    const onOpenChange = vi.fn();
    renderMenu(onOpenChange);
    const trigger = screen.getByText('Operator');
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    // Simulate the stale-hover case: something asks us to re-check, but the
    // cursor is still (per the browser's own hit-test) resting on the trigger.
    vi.spyOn(trigger, 'matches').mockReturnValue(true);
    fireEvent.mouseLeave(trigger);
    vi.advanceTimersByTime(250);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('reports a close once the pointer has genuinely left', () => {
    const onOpenChange = vi.fn();
    renderMenu(onOpenChange);
    const trigger = screen.getByText('Operator');
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    fireEvent.mouseLeave(trigger);
    vi.advanceTimersByTime(250);

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe('menu dismiss report', () => {
  let fakeNow = Date.now();

  beforeEach(() => {
    // A minute apart, so one test's deliberate close never counts as recent in the next
    fakeNow += 60_000;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(fakeNow);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(Sentry.captureMessage).mockClear();
    vi.mocked(Sentry.addBreadcrumb).mockClear();
  });

  const messages = () => vi.mocked(Sentry.captureMessage).mock.calls.map(([message]) => message);

  const ControlledMenu = ({ withSub = true }: { withSub?: boolean }) => {
    const [open, setOpen] = useState(true);
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuContent>
          <DropdownMenuItem>Whois</DropdownMenuItem>
          {withSub && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Operator</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Kick</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Like ContextMenu: the content component stays rendered and only `open` changes
  const AppControlledMenu = ({ open }: { open: boolean }) => (
    <DropdownMenu open={open}>
      <DropdownMenuContent>
        <DropdownMenuItem>Whois</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  it('reports a menu the app closes without a dismiss or item pick', async () => {
    const { rerender } = render(<AppControlledMenu open />);
    rerender(<AppControlledMenu open={false} />);
    await act(async () => {});

    expect(messages()).toContain('Menu closed without user action');
  });

  it('measures how long the menu was open from each opening, not from the first render', async () => {
    const { rerender } = render(<AppControlledMenu open={false} />);
    vi.setSystemTime(fakeNow + 5000);
    rerender(<AppControlledMenu open />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(document.body);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Menu dismissed suspiciously fast',
      expect.objectContaining({ extra: expect.objectContaining({ msOpen: 0 }) })
    );
  });

  it('does not report a menu closed by picking an item', async () => {
    render(<ControlledMenu />);
    fireEvent.click(screen.getByText('Whois'));
    await act(async () => {});

    expect(screen.queryByText('Whois')).not.toBeInTheDocument();
    expect(messages()).not.toContain('Menu closed without user action');
  });

  it('flags a submenu dropped by a re-render as closed without user action', () => {
    const { rerender } = render(<ControlledMenu />);
    fireEvent.click(screen.getByText('Operator'));
    rerender(<ControlledMenu withSub={false} />);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'DropdownMenuSub closed suspiciously fast',
      expect.objectContaining({ extra: expect.objectContaining({ sub: 'Operator', afterUserAction: false }) })
    );
  });

  it('records why Radix closed a submenu before the close is reported', () => {
    render(<ControlledMenu />);
    const trigger = screen.getByText('Operator');
    fireEvent.click(trigger);
    // jsdom reports `:hover` as matching, which would make the guard veto this close
    vi.spyOn(trigger, 'matches').mockReturnValue(false);
    const submenu = screen.getByText('Kick').closest('[role="menu"]');
    if (!submenu) throw new Error('submenu not rendered');
    vi.spyOn(submenu, 'matches').mockReturnValue(false);
    fireEvent.focusIn(screen.getByText('Whois'));

    const dismissOrder = vi.mocked(Sentry.addBreadcrumb).mock.calls.findIndex(([crumb]) => crumb.category === 'menu-dismiss');
    expect(dismissOrder).not.toBe(-1);
    const dismissCall = vi.mocked(Sentry.addBreadcrumb).mock.invocationCallOrder[dismissOrder] ?? Infinity;
    const reportCall = vi.mocked(Sentry.captureMessage).mock.invocationCallOrder[messages().indexOf('DropdownMenuSub closed suspiciously fast')] ?? -Infinity;
    expect(dismissCall).toBeLessThan(reportCall);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'DropdownMenuSub closed suspiciously fast',
      expect.objectContaining({ extra: expect.objectContaining({ afterUserAction: true }) })
    );
  });

  const renderRoot = () =>
    render(
      <>
        <DropdownMenu open>
          <DropdownMenuContent>
            <DropdownMenuItem>Whois</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );

  it('reports a pointer press outside right after opening', async () => {
    renderRoot();
    // Radix starts listening for outside presses on the next tick
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(document.body);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Menu dismissed suspiciously fast',
      expect.objectContaining({ extra: expect.objectContaining({ menu: 'menu', kind: 'dismissableLayer.pointerDownOutside' }) })
    );
  });

});
