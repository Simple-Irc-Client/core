import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from '../dropdown-menu';

// Radix alone decides when a submenu closes: its pointer grace area keeps the submenu open while the
// pointer crosses neighbouring items on its way there. A timer of our own on mouseleave used to close it
// mid-way (seen in Sentry when the submenu flipped left over a narrow window).
//
// Assertions go through `onOpenChange` rather than checking whether the
// submenu content is still in the DOM: Radix's SubContent stays mounted in
// jsdom while its (nonexistent) exit animation never fires, so a DOM-presence
// assertion can't distinguish "still open" from "closed but not yet unmounted".
describe('DropdownMenuSub', () => {
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
          <DropdownMenuItem>Whois</DropdownMenuItem>
          <DropdownMenuSub onOpenChange={onOpenChange}>
            <DropdownMenuSubTrigger>Operator</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Kick</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

  // Inside the root menu's scroll container WebKit clipped the submenu out of sight
  it('renders the submenu outside the root menu', () => {
    renderMenu(vi.fn());
    fireEvent.click(screen.getByText('Operator'));

    const rootMenu = screen.getByText('Whois').closest('[role="menu"]');
    expect(rootMenu?.contains(screen.getByText('Kick'))).toBe(false);
  });

  it('stays open after the pointer leaves the trigger and pauses outside the submenu', () => {
    const onOpenChange = vi.fn();
    renderMenu(onOpenChange);
    const trigger = screen.getByText('Operator');
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    vi.spyOn(trigger, 'matches').mockReturnValue(false);
    fireEvent.mouseLeave(trigger);
    vi.advanceTimersByTime(1000);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  // Radix focuses the parent menu itself when the pointer leaves its items, e.g. for the space outside the menus
  it('stays open when the pointer leaves the items and the parent menu itself takes focus', () => {
    const onOpenChange = vi.fn();
    renderMenu(onOpenChange);
    fireEvent.click(screen.getByText('Operator'));
    const parentMenu = screen.getByText('Whois').closest('[role="menu"]');
    if (!(parentMenu instanceof HTMLElement)) throw new Error('parent menu not rendered');

    fireEvent.focusIn(parentMenu);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('closes when another item of the parent menu takes focus', () => {
    const onOpenChange = vi.fn();
    renderMenu(onOpenChange);
    fireEvent.click(screen.getByText('Operator'));

    fireEvent.focusIn(screen.getByText('Whois'));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('closes, with the whole menu, on a press outside the menus', () => {
    const onRootOpenChange = vi.fn();
    const StatefulMenu = () => {
      const [open, setOpen] = useState(true);
      return (
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            onRootOpenChange(next);
            setOpen(next);
          }}
        >
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Operator</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Kick</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    };
    render(<StatefulMenu />);
    fireEvent.click(screen.getByText('Operator'));
    // Radix defers registering its outside-pointerdown listener by one tick
    vi.advanceTimersByTime(1);

    fireEvent.pointerDown(document.body);

    expect(onRootOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText('Kick')).not.toBeInTheDocument();
  });
});

