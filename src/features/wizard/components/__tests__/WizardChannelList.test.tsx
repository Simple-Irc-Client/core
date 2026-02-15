import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardChannelList from '../WizardChannelList';
import * as channelsStore from '@features/channels/store/channels';
import * as channelListStore from '@features/channels/store/channelList';
import * as settingsStore from '@features/settings/store/settings';
import * as network from '@/network/irc/network';
import { ChannelCategory } from '@shared/types';
import type { Channel, ChannelList } from '@shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircJoinChannels: vi.fn(),
}));

vi.mock('@features/settings/store/settings', () => ({
  setWizardCompleted: vi.fn(),
}));

const createChannelList = (overrides: Partial<ChannelList> & { name: string }): ChannelList => ({
  users: 10,
  topic: '',
  ...overrides,
});

const createChannel = (overrides: Partial<Channel> & { name: string }): Channel => ({
  category: ChannelCategory.channel,
  unReadMessages: 0,
  ...overrides,
});

describe('WizardChannelList', () => {
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

  const setupMocks = (overrides: {
    isChannelListLoadingFinished?: boolean;
    channelList?: ChannelList[];
    openChannels?: Channel[];
  } = {}) => {
    const {
      isChannelListLoadingFinished = true,
      channelList = [],
      openChannels = [],
    } = overrides;

    vi.spyOn(channelListStore, 'useChannelListStore').mockImplementation((selector) =>
      selector({
        finished: isChannelListLoadingFinished,
        channels: channelList,
        setAddChannel: vi.fn(),
        setClear: vi.fn(),
        setFinished: vi.fn(),
      })
    );

    vi.spyOn(channelListStore, 'getChannelListSortedByUsers').mockReturnValue(channelList);

    vi.spyOn(channelsStore, 'useChannelsStore').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ openChannelsShortList: openChannels })
    );
  };

  describe('Basic rendering', () => {
    it('should render the title', () => {
      setupMocks();

      render(<WizardChannelList />);

      expect(screen.getByText('wizard.channels.title')).toBeInTheDocument();
    });

    it('should render skip and join buttons', () => {
      setupMocks();

      render(<WizardChannelList />);

      expect(screen.getByText('wizard.channels.button.skip')).toBeInTheDocument();
      expect(screen.getByText('wizard.channels.button.join')).toBeInTheDocument();
    });

    it('should render search input', () => {
      setupMocks();

      render(<WizardChannelList />);

      expect(screen.getByPlaceholderText('wizard.channels.toolbar.search.placeholder')).toBeInTheDocument();
    });

    it('should render table headers when channel list is loaded', () => {
      setupMocks({
        isChannelListLoadingFinished: true,
        channelList: [createChannelList({ name: '#test' })],
      });

      render(<WizardChannelList />);

      expect(screen.getByText('wizard.channels.column.name')).toBeInTheDocument();
      expect(screen.getByText('wizard.channels.column.users')).toBeInTheDocument();
      expect(screen.getByText('wizard.channels.column.topic')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading message when channel list is not finished', () => {
      setupMocks({
        isChannelListLoadingFinished: false,
      });

      render(<WizardChannelList />);

      expect(screen.getByText('wizard.channels.loading')).toBeInTheDocument();
    });

    it('should not show table when loading', () => {
      setupMocks({
        isChannelListLoadingFinished: false,
      });

      render(<WizardChannelList />);

      expect(screen.queryByText('wizard.channels.column.name')).not.toBeInTheDocument();
    });
  });

  describe('Channel list display', () => {
    it('should display channels in the table', () => {
      setupMocks({
        channelList: [
          createChannelList({ name: '#channel1', users: 50, topic: 'Topic 1' }),
          createChannelList({ name: '#channel2', users: 30, topic: 'Topic 2' }),
        ],
      });

      render(<WizardChannelList />);

      expect(screen.getByText('#channel1')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('Topic 1')).toBeInTheDocument();

      expect(screen.getByText('#channel2')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('Topic 2')).toBeInTheDocument();
    });

    it('should show no results message when channel list is empty', () => {
      setupMocks({
        isChannelListLoadingFinished: true,
        channelList: [],
      });

      render(<WizardChannelList />);

      expect(screen.getByText('wizard.channels.toolbar.search.no.results')).toBeInTheDocument();
    });
  });

  describe('Search functionality', () => {
    it('should filter channels by name', () => {
      setupMocks({
        channelList: [
          createChannelList({ name: '#general', users: 50 }),
          createChannelList({ name: '#random', users: 30 }),
          createChannelList({ name: '#help', users: 20 }),
        ],
      });

      render(<WizardChannelList />);

      const searchInput = screen.getByPlaceholderText('wizard.channels.toolbar.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'general' } });

      expect(screen.getByText('#general')).toBeInTheDocument();
      expect(screen.queryByText('#random')).not.toBeInTheDocument();
      expect(screen.queryByText('#help')).not.toBeInTheDocument();
    });

    it('should filter channels by topic', () => {
      setupMocks({
        channelList: [
          createChannelList({ name: '#channel1', topic: 'Welcome to general chat' }),
          createChannelList({ name: '#channel2', topic: 'Tech support' }),
        ],
      });

      render(<WizardChannelList />);

      const searchInput = screen.getByPlaceholderText('wizard.channels.toolbar.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'support' } });

      expect(screen.queryByText('#channel1')).not.toBeInTheDocument();
      expect(screen.getByText('#channel2')).toBeInTheDocument();
    });

    it('should be case insensitive', () => {
      setupMocks({
        channelList: [
          createChannelList({ name: '#General' }),
          createChannelList({ name: '#random' }),
        ],
      });

      render(<WizardChannelList />);

      const searchInput = screen.getByPlaceholderText('wizard.channels.toolbar.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'GENERAL' } });

      expect(screen.getByText('#General')).toBeInTheDocument();
      expect(screen.queryByText('#random')).not.toBeInTheDocument();
    });

    it('should show no results when search has no matches', () => {
      setupMocks({
        channelList: [
          createChannelList({ name: '#general' }),
          createChannelList({ name: '#random' }),
        ],
      });

      render(<WizardChannelList />);

      const searchInput = screen.getByPlaceholderText('wizard.channels.toolbar.search.placeholder');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('wizard.channels.toolbar.search.no.results')).toBeInTheDocument();
    });
  });

  describe('Channel selection', () => {
    it('should add channel to selected when row is clicked', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
      });

      render(<WizardChannelList />);

      const row = getChannelRow('#general');
      fireEvent.click(row);

      // Selected channel should appear as a badge
      const badges = screen.getAllByText('#general');
      expect(badges.length).toBe(2); // One in table, one in badges
    });

    it('should not add duplicate channels when clicking same row', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
      });

      render(<WizardChannelList />);

      const row = getChannelRow('#general');
      fireEvent.click(row);
      fireEvent.click(row);

      // Should still only have 2 instances (table + badge)
      const badges = screen.getAllByText('#general');
      expect(badges.length).toBe(2);
    });

    it('should remove channel from selected when delete button is clicked', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
      });

      render(<WizardChannelList />);

      // First select the channel
      const row = getChannelRow('#general');
      fireEvent.click(row);

      // Verify it's selected (2 instances)
      expect(screen.getAllByText('#general').length).toBe(2);

      // Find and click the delete button in the badge
      const deleteButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('svg.lucide-x')
      );
      const deleteButton = deleteButtons[0];
      if (!deleteButton) {
        throw new Error('Delete button not found');
      }
      fireEvent.click(deleteButton);

      // Should now only have 1 instance (in table)
      expect(screen.getAllByText('#general').length).toBe(1);
    });

    it('should display multiple selected channels as badges', () => {
      setupMocks({
        channelList: [
          createChannelList({ name: '#channel1' }),
          createChannelList({ name: '#channel2' }),
          createChannelList({ name: '#channel3' }),
        ],
      });

      render(<WizardChannelList />);

      // Select multiple channels
      fireEvent.click(getChannelRow('#channel1'));
      fireEvent.click(getChannelRow('#channel2'));
      fireEvent.click(getChannelRow('#channel3'));

      // All should appear twice (table + badge)
      expect(screen.getAllByText('#channel1').length).toBe(2);
      expect(screen.getAllByText('#channel2').length).toBe(2);
      expect(screen.getAllByText('#channel3').length).toBe(2);
    });
  });

  describe('Join button', () => {
    it('should be disabled when no channels are selected', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
      });

      render(<WizardChannelList />);

      const joinButton = screen.getByText('wizard.channels.button.join');
      expect(joinButton).toBeDisabled();
    });

    it('should be enabled when channels are selected', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
      });

      render(<WizardChannelList />);

      // Select a channel
      fireEvent.click(getChannelRow('#general'));

      const joinButton = screen.getByText('wizard.channels.button.join');
      expect(joinButton).not.toBeDisabled();
    });

    it('should call ircJoinChannels with selected channels when clicked', () => {
      setupMocks({
        channelList: [
          createChannelList({ name: '#channel1' }),
          createChannelList({ name: '#channel2' }),
        ],
      });

      render(<WizardChannelList />);

      // Select channels
      fireEvent.click(getChannelRow('#channel1'));
      fireEvent.click(getChannelRow('#channel2'));

      // Click join
      const joinButton = screen.getByText('wizard.channels.button.join');
      fireEvent.click(joinButton);

      expect(network.ircJoinChannels).toHaveBeenCalledWith(['#channel1', '#channel2']);
    });

    it('should call setWizardCompleted when join is clicked', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
      });

      render(<WizardChannelList />);

      // Select a channel
      fireEvent.click(getChannelRow('#general'));

      // Click join
      const joinButton = screen.getByText('wizard.channels.button.join');
      fireEvent.click(joinButton);

      expect(settingsStore.setWizardCompleted).toHaveBeenCalledWith(true);
    });
  });

  describe('Skip button', () => {
    it('should call setWizardCompleted when clicked', () => {
      setupMocks();

      render(<WizardChannelList />);

      const skipButton = screen.getByText('wizard.channels.button.skip');
      fireEvent.click(skipButton);

      expect(settingsStore.setWizardCompleted).toHaveBeenCalledWith(true);
    });

    it('should be hidden when channels are selected', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
      });

      render(<WizardChannelList />);

      // Skip button visible when no channels selected
      expect(screen.getByText('wizard.channels.button.skip')).toBeInTheDocument();

      // Select a channel
      fireEvent.click(getChannelRow('#general'));

      // Skip button should be hidden
      expect(screen.queryByText('wizard.channels.button.skip')).not.toBeInTheDocument();
    });
  });

  describe('Auto-select open channels', () => {
    it('should auto-select channels that are already open', () => {
      setupMocks({
        channelList: [
          createChannelList({ name: '#general' }),
          createChannelList({ name: '#random' }),
        ],
        openChannels: [
          createChannel({ name: '#general' }),
        ],
      });

      render(<WizardChannelList />);

      // #general should appear as a badge (auto-selected) + in table
      expect(screen.getAllByText('#general').length).toBe(2);
      // #random should only appear in table
      expect(screen.getAllByText('#random').length).toBe(1);
    });

    it('should not auto-select Status channel', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
        openChannels: [
          createChannel({ name: 'Status', category: ChannelCategory.status }),
        ],
      });

      render(<WizardChannelList />);

      // Status should not appear in badges
      expect(screen.queryAllByText('Status').length).toBe(0);
    });

    it('should not auto-select Debug channel', () => {
      setupMocks({
        channelList: [createChannelList({ name: '#general' })],
        openChannels: [
          createChannel({ name: 'Debug', category: ChannelCategory.debug }),
        ],
      });

      render(<WizardChannelList />);

      // Debug should not appear in badges
      expect(screen.queryAllByText('Debug').length).toBe(0);
    });
  });
});
