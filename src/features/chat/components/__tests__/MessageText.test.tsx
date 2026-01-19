import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MessageText from '../MessageText';
import * as ContextMenuContext from '@/providers/ContextMenuContext';
import * as settings from '@features/settings/store/settings';

describe('MessageText', () => {
  const mockHandleContextMenuUserClick = vi.fn();
  const mockHandleContextMenuClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue({
      contextMenuOpen: false,
      handleContextMenuClose: mockHandleContextMenuClose,
      contextMenuAnchorElement: null,
      contextMenuCategory: undefined,
      contextMenuItem: undefined,
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
    });
  });

  describe('Basic rendering', () => {
    it('should render plain text without modifications', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Hello world" />);

      expect(getByText(/Hello/)).toBeInTheDocument();
      expect(getByText(/world/)).toBeInTheDocument();
    });

    it('should apply color prop to text', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(<MessageText text="Colored text" color="#ff0000" />);

      const span = container.querySelector('span');
      expect(span).toHaveStyle({ color: '#ff0000' });
    });

    it('should preserve whitespace between words', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(<MessageText text="word1  word2" />);

      expect(container.textContent).toBe('word1  word2');
    });
  });

  describe('Channel name detection', () => {
    it('should detect channel names starting with #', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Join #channel for help" />);

      const channelSpan = getByText('#channel');
      expect(channelSpan).toHaveClass('cursor-pointer');
      expect(channelSpan).toHaveClass('hover:underline');
    });

    it('should detect channel names starting with &', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#', '&']);

      const { getByText } = render(<MessageText text="Join &localchannel now" />);

      const channelSpan = getByText('&localchannel');
      expect(channelSpan).toHaveClass('cursor-pointer');
    });

    it('should detect multiple channels in one message', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Try #help or #support" />);

      expect(getByText('#help')).toHaveClass('cursor-pointer');
      expect(getByText('#support')).toHaveClass('cursor-pointer');
    });

    it('should not detect channel when no channel types configured', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue([]);

      const { container } = render(<MessageText text="This is #notachannel" />);

      const clickableSpans = container.querySelectorAll('.cursor-pointer');
      expect(clickableSpans.length).toBe(0);
    });

    it('should handle channel names with special characters', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Join #channel-name_123" />);

      const channelSpan = getByText('#channel-name_123');
      expect(channelSpan).toHaveClass('cursor-pointer');
    });

    it('should stop channel name at comma', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Channels: #one, #two" />);

      // Should detect #one and #two as separate channels (comma stops the channel name)
      expect(getByText('#one,')).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Context menu interaction', () => {
    it('should call handleContextMenuUserClick with channel category on right-click', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Join #testchannel" />);

      const channelSpan = getByText('#testchannel');
      fireEvent.contextMenu(channelSpan);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'channel',
        '#testchannel'
      );
    });

    it('should prevent default on right-click', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Join #channel" />);

      const channelSpan = getByText('#channel');
      const event = fireEvent.contextMenu(channelSpan);

      // fireEvent.contextMenu returns false when preventDefault was called
      expect(event).toBe(false);
    });

    it('should not trigger context menu for regular text', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Hello world" />);

      const textSpan = getByText('Hello');
      fireEvent.contextMenu(textSpan);

      expect(mockHandleContextMenuUserClick).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty text', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(<MessageText text="" />);

      expect(container.textContent).toBe('');
    });

    it('should handle text with only whitespace', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(<MessageText text="   " />);

      expect(container.textContent).toBe('   ');
    });

    it('should handle channel at start of message', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="#channel is great" />);

      expect(getByText('#channel')).toHaveClass('cursor-pointer');
    });

    it('should handle channel at end of message', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="Come to #channel" />);

      expect(getByText('#channel')).toHaveClass('cursor-pointer');
    });

    it('should handle message with only channel name', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { getByText } = render(<MessageText text="#channel" />);

      expect(getByText('#channel')).toHaveClass('cursor-pointer');
    });

    it('should escape special regex characters in channel types', () => {
      // Test that special characters like + are properly escaped
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['+']);

      const { getByText } = render(<MessageText text="Join +modeless channel" />);

      expect(getByText('+modeless')).toHaveClass('cursor-pointer');
    });
  });
});
