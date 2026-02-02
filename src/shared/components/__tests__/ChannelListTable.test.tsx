import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelListTable from '../ChannelListTable';
import type { ChannelList } from '@shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const createChannelList = (overrides: Partial<ChannelList> & { name: string }): ChannelList => ({
  users: 10,
  topic: '',
  ...overrides,
});

describe('ChannelListTable', () => {
  const mockOnSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getChannelRow = (name: string): HTMLElement => {
    const cell = screen.getByText(name);
    const row = cell.closest('tr');
    if (!row) {
      throw new Error(`Row not found for channel: ${name}`);
    }
    return row;
  };

  describe('Basic rendering', () => {
    it('should render search input', () => {
      render(
        <ChannelListTable
          channelList={[]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByPlaceholderText('channelListDialog.search.placeholder')).toBeInTheDocument();
    });

    it('should render table headers when channels are loaded', () => {
      render(
        <ChannelListTable
          channelList={[createChannelList({ name: '#test' })]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByText('channelListDialog.column.name')).toBeInTheDocument();
      expect(screen.getByText('channelListDialog.column.users')).toBeInTheDocument();
      expect(screen.getByText('channelListDialog.column.topic')).toBeInTheDocument();
    });

    it('should render custom translations when provided', () => {
      render(
        <ChannelListTable
          channelList={[createChannelList({ name: '#test' })]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
          translations={{
            searchPlaceholder: 'Custom Search',
            columnName: 'Custom Name',
            columnUsers: 'Custom Users',
            columnTopic: 'Custom Topic',
          }}
        />
      );

      expect(screen.getByPlaceholderText('Custom Search')).toBeInTheDocument();
      expect(screen.getByText('Custom Name')).toBeInTheDocument();
      expect(screen.getByText('Custom Users')).toBeInTheDocument();
      expect(screen.getByText('Custom Topic')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading message when isLoading is true', () => {
      render(
        <ChannelListTable
          channelList={[]}
          isLoading={true}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByText('channelListDialog.loading')).toBeInTheDocument();
    });

    it('should not show table when loading', () => {
      render(
        <ChannelListTable
          channelList={[]}
          isLoading={true}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.queryByText('channelListDialog.column.name')).not.toBeInTheDocument();
    });
  });

  describe('Channel list display', () => {
    it('should display channels in the table', () => {
      render(
        <ChannelListTable
          channelList={[
            createChannelList({ name: '#channel1', users: 50, topic: 'Topic 1' }),
            createChannelList({ name: '#channel2', users: 30, topic: 'Topic 2' }),
          ]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByText('#channel1')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('Topic 1')).toBeInTheDocument();

      expect(screen.getByText('#channel2')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('Topic 2')).toBeInTheDocument();
    });

    it('should show no results message when channel list is empty', () => {
      render(
        <ChannelListTable
          channelList={[]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(screen.getByText('channelListDialog.noResults')).toBeInTheDocument();
    });

    it('should exclude channels specified in excludeChannels', () => {
      render(
        <ChannelListTable
          channelList={[
            createChannelList({ name: '#channel1' }),
            createChannelList({ name: '#channel2' }),
          ]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
          excludeChannels={['#channel1']}
        />
      );

      expect(screen.queryByText('#channel1')).not.toBeInTheDocument();
      expect(screen.getByText('#channel2')).toBeInTheDocument();
    });
  });

  describe('Search functionality', () => {
    it('should filter channels by name', () => {
      render(
        <ChannelListTable
          channelList={[
            createChannelList({ name: '#general', users: 50 }),
            createChannelList({ name: '#random', users: 30 }),
            createChannelList({ name: '#help', users: 20 }),
          ]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText('channelListDialog.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'general' } });

      expect(screen.getByText('#general')).toBeInTheDocument();
      expect(screen.queryByText('#random')).not.toBeInTheDocument();
      expect(screen.queryByText('#help')).not.toBeInTheDocument();
    });

    it('should filter channels by topic', () => {
      render(
        <ChannelListTable
          channelList={[
            createChannelList({ name: '#channel1', topic: 'Welcome to general chat' }),
            createChannelList({ name: '#channel2', topic: 'Tech support' }),
          ]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText('channelListDialog.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'support' } });

      expect(screen.queryByText('#channel1')).not.toBeInTheDocument();
      expect(screen.getByText('#channel2')).toBeInTheDocument();
    });

    it('should be case insensitive', () => {
      render(
        <ChannelListTable
          channelList={[
            createChannelList({ name: '#General' }),
            createChannelList({ name: '#random' }),
          ]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText('channelListDialog.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'GENERAL' } });

      expect(screen.getByText('#General')).toBeInTheDocument();
      expect(screen.queryByText('#random')).not.toBeInTheDocument();
    });

    it('should show no results when search has no matches', () => {
      render(
        <ChannelListTable
          channelList={[
            createChannelList({ name: '#general' }),
            createChannelList({ name: '#random' }),
          ]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const searchInput = screen.getByPlaceholderText('channelListDialog.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('channelListDialog.noResults')).toBeInTheDocument();
    });
  });

  describe('Channel selection', () => {
    it('should call onSelectionChange when row is clicked', () => {
      render(
        <ChannelListTable
          channelList={[createChannelList({ name: '#general' })]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const row = getChannelRow('#general');
      fireEvent.click(row);

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['#general']);
    });

    it('should not add duplicate channels when clicking same row', () => {
      render(
        <ChannelListTable
          channelList={[createChannelList({ name: '#general' })]}
          isLoading={false}
          selectedChannels={['#general']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Find the table row specifically (not the badge)
      const tableCell = screen.getByRole('cell', { name: '#general' });
      const row = tableCell.closest('tr');
      if (!row) {
        throw new Error('Row not found');
      }
      fireEvent.click(row);

      expect(mockOnSelectionChange).not.toHaveBeenCalled();
    });

    it('should display selected channels as badges', () => {
      render(
        <ChannelListTable
          channelList={[createChannelList({ name: '#general' })]}
          isLoading={false}
          selectedChannels={['#general', '#random']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Both selected channels should appear as badges
      const badges = screen.getAllByText(/#general|#random/);
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it('should call onSelectionChange with removed channel when delete button is clicked', () => {
      render(
        <ChannelListTable
          channelList={[createChannelList({ name: '#general' })]}
          isLoading={false}
          selectedChannels={['#general', '#random']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Find and click the delete button for #general
      const deleteButton = screen.getByRole('button', { name: 'Remove #general' });
      fireEvent.click(deleteButton);

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['#random']);
    });

    it('should add multiple channels to selection', () => {
      const { rerender } = render(
        <ChannelListTable
          channelList={[
            createChannelList({ name: '#channel1' }),
            createChannelList({ name: '#channel2' }),
            createChannelList({ name: '#channel3' }),
          ]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Click first channel
      fireEvent.click(getChannelRow('#channel1'));
      expect(mockOnSelectionChange).toHaveBeenCalledWith(['#channel1']);

      // Rerender with updated selection
      rerender(
        <ChannelListTable
          channelList={[
            createChannelList({ name: '#channel1' }),
            createChannelList({ name: '#channel2' }),
            createChannelList({ name: '#channel3' }),
          ]}
          isLoading={false}
          selectedChannels={['#channel1']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Click second channel
      fireEvent.click(getChannelRow('#channel2'));
      expect(mockOnSelectionChange).toHaveBeenCalledWith(['#channel1', '#channel2']);
    });
  });

  describe('Custom height', () => {
    it('should apply custom height to the table container', () => {
      render(
        <ChannelListTable
          channelList={[createChannelList({ name: '#test' })]}
          isLoading={false}
          selectedChannels={[]}
          onSelectionChange={mockOnSelectionChange}
          height={500}
        />
      );

      const tableContainer = screen.getByText('#test').closest('.border.rounded-lg');
      expect(tableContainer).toHaveStyle({ height: '500px' });
    });
  });
});
