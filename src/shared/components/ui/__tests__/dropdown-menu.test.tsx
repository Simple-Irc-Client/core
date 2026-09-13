import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
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
