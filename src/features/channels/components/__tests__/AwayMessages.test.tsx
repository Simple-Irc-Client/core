import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AwayMessages from '../AwayMessages';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

const mockClearAwayMessages = vi.fn();
let mockAwayMessages: unknown[] = [];

vi.mock('@features/channels/store/awayMessages', () => ({
  useAwayMessagesStore: (selector: (state: { messages: unknown[] }) => unknown) => selector({ messages: mockAwayMessages }),
  clearAwayMessages: () => mockClearAwayMessages(),
}));

describe('AwayMessages', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAwayMessages = [];
  });

  describe('Dialog rendering', () => {
    it('should render dialog when open is true', () => {
      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      expect(document.body.textContent).toContain('main.toolbar.awayMessages');
      expect(document.body.textContent).toContain('main.toolbar.awayMessagesDescription');
    });

    it('should not render dialog when open is false', () => {
      render(<AwayMessages open={false} onOpenChange={mockOnOpenChange} />);

      expect(document.body.textContent).not.toContain('main.toolbar.awayMessagesDescription');
    });

    it('should show no messages text when away messages are empty', () => {
      mockAwayMessages = [];

      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      expect(document.body.textContent).toContain('main.toolbar.noAwayMessages');
    });

    it('should show Mark as Read button', () => {
      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('main.toolbar.markAsRead')).toBeInTheDocument();
    });
  });

  describe('Displaying messages', () => {
    it('should display away messages', () => {
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Hey testUser!',
          nick: 'sender1',
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      expect(document.body.textContent).toContain('Hey testUser!');
      expect(document.body.textContent).toContain('#test');
      expect(document.body.textContent).toContain('sender1');
    });

    it('should display multiple away messages', () => {
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'First message',
          nick: 'user1',
          target: '#channel1',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#channel1',
        },
        {
          id: 'msg-2',
          message: 'Second message',
          nick: 'user2',
          target: '#channel2',
          time: '2024-01-01T12:01:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#channel2',
        },
      ];

      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      expect(document.body.textContent).toContain('First message');
      expect(document.body.textContent).toContain('Second message');
      expect(document.body.textContent).toContain('user1');
      expect(document.body.textContent).toContain('user2');
    });

    it('should handle nick as object with nick property', () => {
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Test message',
          nick: { nick: 'objectNick', modes: [] },
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      expect(document.body.textContent).toContain('objectNick');
    });
  });

  describe('Mark as Read functionality', () => {
    it('should call clearAwayMessages when clicking Mark as Read', async () => {
      const user = userEvent.setup();
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Hey testUser!',
          nick: 'sender1',
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      const markAsReadButton = screen.getByText('main.toolbar.markAsRead');
      await user.click(markAsReadButton);

      expect(mockClearAwayMessages).toHaveBeenCalled();
    });

    it('should call onOpenChange with false when clicking Mark as Read', async () => {
      const user = userEvent.setup();
      mockAwayMessages = [];

      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      const markAsReadButton = screen.getByText('main.toolbar.markAsRead');
      await user.click(markAsReadButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should clear messages and close dialog on Mark as Read', async () => {
      const user = userEvent.setup();
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Test message',
          nick: 'sender',
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      const markAsReadButton = screen.getByText('main.toolbar.markAsRead');
      await user.click(markAsReadButton);

      expect(mockClearAwayMessages).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Dialog close behavior', () => {
    it('should not clear messages when dialog is closed via X button', async () => {
      const user = userEvent.setup();
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Test message',
          nick: 'sender',
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      render(<AwayMessages open={true} onOpenChange={mockOnOpenChange} />);

      // Click the close button (X button in dialog)
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockClearAwayMessages).not.toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
