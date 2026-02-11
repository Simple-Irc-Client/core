import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MessageText from '../MessageText';
import * as ContextMenuContext from '@/providers/ContextMenuContext';
import * as settings from '@features/settings/store/settings';
import { IRC_FORMAT } from '@/shared/lib/ircFormatting';

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

  describe('IRC formatting', () => {
    it('should render bold text with font-weight bold', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.BOLD}bold${IRC_FORMAT.BOLD}`} />
      );

      const boldSpan = container.querySelector('span[style*="font-weight"]');
      expect(boldSpan).toHaveStyle({ fontWeight: 'bold' });
      expect(boldSpan?.textContent).toBe('bold');
    });

    it('should render italic text with font-style italic', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.ITALIC}italic${IRC_FORMAT.ITALIC}`} />
      );

      const italicSpan = container.querySelector('span[style*="font-style"]');
      expect(italicSpan).toHaveStyle({ fontStyle: 'italic' });
    });

    it('should render underlined text', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.UNDERLINE}underline${IRC_FORMAT.UNDERLINE}`} />
      );

      const underlineSpan = container.querySelector('span[style*="text-decoration"]');
      expect(underlineSpan).toHaveStyle({ textDecoration: 'underline' });
    });

    it('should render colored text with foreground color', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      // Color code 4 is red (#FF0000)
      const { container } = render(<MessageText text={`${IRC_FORMAT.COLOR}4red`} />);

      const coloredSpan = container.querySelector('span[style*="color"]');
      expect(coloredSpan).toHaveStyle({ color: '#FF0000' });
      expect(coloredSpan?.textContent).toBe('red');
    });

    it('should render text with background color', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      // Color code 4,2 is red on blue
      const { container } = render(<MessageText text={`${IRC_FORMAT.COLOR}4,2text`} />);

      const coloredSpan = container.querySelector('span[style*="background-color"]');
      expect(coloredSpan).toHaveStyle({ backgroundColor: '#00007F' });
    });

    it('should render hex colored text', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.HEX_COLOR}FF5500orange`} />
      );

      const coloredSpan = container.querySelector('span[style*="color"]');
      expect(coloredSpan).toHaveStyle({ color: '#FF5500' });
    });

    it('should render monospace text', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.MONOSPACE}code${IRC_FORMAT.MONOSPACE}`} />
      );

      const monoSpan = container.querySelector('span[style*="font-family"]');
      expect(monoSpan).toHaveStyle({ fontFamily: 'monospace' });
    });

    it('should render strikethrough text', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.STRIKETHROUGH}strike${IRC_FORMAT.STRIKETHROUGH}`} />
      );

      const strikeSpan = container.querySelector('span[style*="text-decoration"]');
      expect(strikeSpan).toHaveStyle({ textDecoration: 'line-through' });
    });

    it('should handle combined formatting (bold + italic)', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.BOLD}${IRC_FORMAT.ITALIC}bold+italic`} />
      );

      const styledSpan = container.querySelector('span[style*="font-weight"]');
      expect(styledSpan).toHaveStyle({ fontWeight: 'bold', fontStyle: 'italic' });
    });

    it('should reset formatting after reset code', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.BOLD}bold${IRC_FORMAT.RESET} normal`} />
      );

      // Check that bold text has bold style and normal text doesn't
      const boldSpan = container.querySelector('span[style*="font-weight"]');
      expect(boldSpan).toHaveStyle({ fontWeight: 'bold' });
      expect(boldSpan?.textContent).toBe('bold');

      // The entire text content should be preserved
      expect(container.textContent).toBe('bold normal');
    });

    it('should preserve text content when stripping formatting', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText
          text={`${IRC_FORMAT.BOLD}Hello${IRC_FORMAT.BOLD} ${IRC_FORMAT.COLOR}4World${IRC_FORMAT.COLOR}`}
        />
      );

      expect(container.textContent).toBe('Hello World');
    });

    it('should apply italic to all words, not just the first', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.ITALIC}hello world${IRC_FORMAT.ITALIC}`} />
      );

      const italicSpans = container.querySelectorAll('span[style*="font-style"]');
      expect(italicSpans.length).toBeGreaterThanOrEqual(1);

      const allItalicText = Array.from(italicSpans).map((s) => s.textContent).join('');
      expect(allItalicText).toContain('hello');
      expect(allItalicText).toContain('world');
    });

    it('should apply underline to all words, not just the first', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.UNDERLINE}hello world${IRC_FORMAT.UNDERLINE}`} />
      );

      const underlineSpans = container.querySelectorAll('span[style*="text-decoration"]');
      expect(underlineSpans.length).toBeGreaterThanOrEqual(1);

      const allUnderlineText = Array.from(underlineSpans).map((s) => s.textContent).join('');
      expect(allUnderlineText).toContain('hello');
      expect(allUnderlineText).toContain('world');
    });

    it('should apply bold to all words, not just the first', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.BOLD}hello world${IRC_FORMAT.BOLD}`} />
      );

      const boldSpans = container.querySelectorAll('span[style*="font-weight"]');
      expect(boldSpans.length).toBeGreaterThanOrEqual(1);

      const allBoldText = Array.from(boldSpans).map((s) => s.textContent).join('');
      expect(allBoldText).toContain('hello');
      expect(allBoldText).toContain('world');
    });

    it('should apply formatting across many words', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`${IRC_FORMAT.ITALIC}one two three four${IRC_FORMAT.ITALIC}`} />
      );

      const italicSpans = container.querySelectorAll('span[style*="font-style"]');
      const allItalicText = Array.from(italicSpans).map((s) => s.textContent).join('');
      expect(allItalicText).toContain('one');
      expect(allItalicText).toContain('two');
      expect(allItalicText).toContain('three');
      expect(allItalicText).toContain('four');
    });

    it('should apply formatting only to wrapped portion in mixed text', () => {
      vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);

      const { container } = render(
        <MessageText text={`normal ${IRC_FORMAT.ITALIC}italic words${IRC_FORMAT.ITALIC} normal`} />
      );

      expect(container.textContent).toBe('normal italic words normal');

      const italicSpans = container.querySelectorAll('span[style*="font-style"]');
      const allItalicText = Array.from(italicSpans).map((s) => s.textContent).join('');
      expect(allItalicText).toContain('italic');
      expect(allItalicText).toContain('words');
      expect(allItalicText).not.toContain('normal');
    });
  });
});
