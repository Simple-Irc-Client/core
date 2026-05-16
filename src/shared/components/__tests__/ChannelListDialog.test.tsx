import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// Note: jsdom does not deliver `animationend` to React's onAnimationEnd, so the
// primary close-animation path is covered in real browsers (Playwright/manual);
// these unit tests cover the deferral contract and the fallback/unmount paths.
import ChannelListDialog from '../ChannelListDialog';
import type { ChannelList } from '@shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Emulate the dialog shell staying mounted while `open` is false — this is the
// Radix close-animation window during which the orphaned-table flash occurred.
// Children render regardless of `open`, so the only thing keeping the table out
// of the DOM is ChannelListDialog's own `{open && ...}` gate. DialogContent
// forwards props so `onAnimationEnd` is reachable from tests.
vi.mock('@shared/components/ui/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: passthrough,
    DialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div data-testid="dialog-content" {...props}>{children}</div>
    ),
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
  };
});

// Exposes a button that selects a channel, so the Join button can be enabled.
vi.mock('../ChannelListTable', () => ({
  default: ({ onSelectionChange }: { onSelectionChange: (c: string[]) => void }) => (
    <div data-testid="channel-list-table">
      <button onClick={() => onSelectionChange(['#test'])}>select</button>
    </div>
  ),
}));

const channelList: ChannelList[] = [{ name: '#test', users: 10, topic: '' }];

const renderDialog = (open: boolean, onJoin = vi.fn(), onOpenChange = vi.fn()) => {
  const utils = render(
    <ChannelListDialog open={open} onOpenChange={onOpenChange} channelList={channelList} isLoading={false} onJoin={onJoin} />
  );
  return { ...utils, onJoin, onOpenChange };
};

describe('ChannelListDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('table mounting', () => {
    it('renders the channel list table while open', () => {
      renderDialog(true);
      expect(screen.getByTestId('channel-list-table')).toBeInTheDocument();
    });

    it('does not render the channel list table once closing, even while the dialog shell is still mounted', () => {
      renderDialog(false);
      expect(screen.queryByTestId('channel-list-table')).not.toBeInTheDocument();
    });
  });

  describe('deferred join (decouples the join re-render from the close animation)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('closes the dialog immediately but does not join until the close animation ends', () => {
      const { onJoin, onOpenChange } = renderDialog(true);

      fireEvent.click(screen.getByText('select'));
      fireEvent.click(screen.getByText('channelListDialog.button.join'));

      // Close is requested right away; the heavy join is held back.
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onJoin).not.toHaveBeenCalled();
    });

    it('falls back to a timer when no close animation fires (reduced motion / non-animating webview)', () => {
      vi.useFakeTimers();
      const onJoin = vi.fn();
      render(
        <ChannelListDialog open onOpenChange={vi.fn()} channelList={channelList} isLoading={false} onJoin={onJoin} />
      );

      fireEvent.click(screen.getByText('select'));
      fireEvent.click(screen.getByText('channelListDialog.button.join'));
      expect(onJoin).not.toHaveBeenCalled();

      vi.advanceTimersByTime(350);
      expect(onJoin).toHaveBeenCalledExactlyOnceWith(['#test']);
    });

    it('joins only once even if more timers elapse after the fallback fired', () => {
      vi.useFakeTimers();
      const onJoin = vi.fn();
      render(
        <ChannelListDialog open onOpenChange={vi.fn()} channelList={channelList} isLoading={false} onJoin={onJoin} />
      );

      fireEvent.click(screen.getByText('select'));
      fireEvent.click(screen.getByText('channelListDialog.button.join'));
      vi.advanceTimersByTime(350);
      vi.advanceTimersByTime(1000);

      expect(onJoin).toHaveBeenCalledExactlyOnceWith(['#test']);
    });

    it('flushes a queued join if the dialog unmounts before it closes', () => {
      const onJoin = vi.fn();
      const { unmount } = render(
        <ChannelListDialog open onOpenChange={vi.fn()} channelList={channelList} isLoading={false} onJoin={onJoin} />
      );

      fireEvent.click(screen.getByText('select'));
      fireEvent.click(screen.getByText('channelListDialog.button.join'));
      expect(onJoin).not.toHaveBeenCalled();

      unmount();
      expect(onJoin).toHaveBeenCalledExactlyOnceWith(['#test']);
    });
  });
});
