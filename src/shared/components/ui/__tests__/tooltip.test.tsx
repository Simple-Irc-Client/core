import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';

// Radix opens after a 700ms hover delay; the auto-close timer only starts once
// React has committed that open, so time must advance in separate act() steps.
function hoverUntilAutoClosed(trigger: HTMLElement) {
  fireEvent.pointerMove(trigger);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(10000);
  });
}

function renderTooltip() {
  render(
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button>channel</button>
        </TooltipTrigger>
        <TooltipContent>#channel</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
  return screen.getByRole('button', { name: 'channel' });
}

describe('Tooltip auto-close', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens on hover and closes by itself while the pointer is still on the trigger', () => {
    const trigger = renderTooltip();

    fireEvent.pointerMove(trigger);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not re-open from a stationary pointer after auto-closing', () => {
    const trigger = renderTooltip();

    hoverUntilAutoClosed(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.pointerMove(trigger);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens again after the pointer leaves and re-enters the trigger', () => {
    const trigger = renderTooltip();

    hoverUntilAutoClosed(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.pointerLeave(trigger);
    fireEvent.pointerMove(trigger);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('restarts the timer for each new open', () => {
    const trigger = renderTooltip();

    fireEvent.pointerMove(trigger);
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    fireEvent.pointerLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerMove(trigger);
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    // 2nd open started ~700ms into this window, so it has been open ~8.3s — still under the 10s limit.
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});
