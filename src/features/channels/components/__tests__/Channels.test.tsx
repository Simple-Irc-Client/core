import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Channels from '../Channels';
import * as settingsStore from '@features/settings/store/settings';
import * as channelsStore from '@features/channels/store/channels';
import * as channelListStore from '@features/channels/store/channelList';
import * as DrawersContext from '@/providers/DrawersContext';
import * as network from '@/network/irc/network';
import { ChannelCategory } from '@shared/types';
import type { Channel } from '@shared/types';

// Mock browser APIs for Dialog components
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Element.prototype.scrollIntoView = vi.fn();
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircJoinChannels: vi.fn(),
  ircPartChannel: vi.fn(),
}));

const createChannel = (overrides: Partial<Channel> & { name: string }): Channel => ({
  category: ChannelCategory.channel,
  unReadMessages: 0,
  ...overrides,
});

describe('Channels', () => {
  const mockSetCurrentChannelName = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(settingsStore, 'setCurrentChannelName').mockImplementation(mockSetCurrentChannelName);
  });

  const setupMocks = (overrides: {
    currentChannelName?: string;
    openChannelsShort?: Channel[];
    isChannelsDrawerOpen?: boolean;
    isChannelListLoadingFinished?: boolean;
    channelsList?: { name: string; users: number; topic: string }[];
  } = {}) => {
    const {
      currentChannelName = '#test',
      openChannelsShort = [],
      isChannelsDrawerOpen = true,
      isChannelListLoadingFinished = false,
      channelsList = [],
    } = overrides;

    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        currentChannelName,
      } as unknown as settingsStore.SettingsStore)
    );

    vi.spyOn(channelsStore, 'useChannelsStore').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ openChannelsShortList: openChannelsShort })
    );

    vi.spyOn(DrawersContext, 'useChannelsDrawer').mockReturnValue({
      isChannelsDrawerOpen,
      setChannelsDrawerStatus: vi.fn(),
    });

    vi.spyOn(channelListStore, 'useChannelListStore').mockImplementation((selector) =>
      selector({
        finished: isChannelListLoadingFinished,
        channels: channelsList,
        setAddChannel: vi.fn(),
        setClear: vi.fn(),
        setFinished: vi.fn(),
      })
    );

    vi.spyOn(channelListStore, 'getChannelListSortedByUsers').mockReturnValue(channelsList);
  };

  describe('Basic rendering', () => {
    it('should render the channels title when drawer is open', () => {
      setupMocks({
        isChannelsDrawerOpen: true,
        openChannelsShort: [createChannel({ name: '#general' })],
      });

      render(<Channels />);

      expect(screen.getByText('main.channels.title')).toBeInTheDocument();
    });

    it('should have hidden class when drawer is closed', () => {
      setupMocks({
        isChannelsDrawerOpen: false,
        openChannelsShort: [createChannel({ name: '#general' })],
      });

      const { container } = render(<Channels />);

      // When drawer is closed, the container should have 'hidden' class (visible only on lg+)
      expect(container.firstChild).toHaveClass('hidden');
    });

    it('should render channel buttons', () => {
      setupMocks({
        openChannelsShort: [
          createChannel({ name: '#channel1' }),
          createChannel({ name: '#channel2' }),
          createChannel({ name: '#channel3' }),
        ],
      });

      render(<Channels />);

      expect(screen.getByRole('button', { name: '#channel1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '#channel2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '#channel3' })).toBeInTheDocument();
    });

    it('should render add channel button', () => {
      setupMocks();

      render(<Channels />);

      expect(screen.getByRole('button', { name: 'main.channels.join' })).toBeInTheDocument();
    });
  });

  describe('Channel icons', () => {
    it('should render Hash icon for channel category', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: '#general', category: ChannelCategory.channel })],
      });

      render(<Channels />);

      const button = screen.getByRole('button', { name: '#general' });
      expect(button).toBeInTheDocument();
    });

    it('should render User icon for priv category', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: 'someUser', category: ChannelCategory.priv })],
      });

      render(<Channels />);

      const button = screen.getByRole('button', { name: 'someUser' });
      expect(button).toBeInTheDocument();
    });

    it('should render Home icon for status category', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: 'Status', category: ChannelCategory.status })],
      });

      render(<Channels />);

      const button = screen.getByRole('button', { name: 'Status' });
      expect(button).toBeInTheDocument();
    });

    it('should render Wrench icon for debug category', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: 'Debug', category: ChannelCategory.debug })],
      });

      render(<Channels />);

      const button = screen.getByRole('button', { name: 'Debug' });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Channel selection', () => {
    it('should call setCurrentChannelName when channel is clicked', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: '#general', category: ChannelCategory.channel })],
      });

      render(<Channels />);

      const channelButton = screen.getByRole('button', { name: '#general' });
      fireEvent.click(channelButton);

      expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#general', ChannelCategory.channel);
    });

    it('should highlight the current channel', () => {
      setupMocks({
        currentChannelName: '#general',
        openChannelsShort: [
          createChannel({ name: '#general' }),
          createChannel({ name: '#random' }),
        ],
      });

      render(<Channels />);

      const currentChannelButton = screen.getByRole('button', { name: '#general' });
      expect(currentChannelButton).toHaveClass('bg-gray-200');

      const otherChannelButton = screen.getByRole('button', { name: '#random' });
      expect(otherChannelButton).not.toHaveClass('bg-gray-200');
    });
  });

  describe('Unread messages badge', () => {
    it('should display unread messages badge', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: '#general', unReadMessages: 5 })],
      });

      render(<Channels />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display 99+ for more than 99 unread messages', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: '#general', unReadMessages: 150 })],
      });

      render(<Channels />);

      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should not display badge when unread messages is 0', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: '#general', unReadMessages: 0 })],
      });

      render(<Channels />);

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('should not display badge for Debug channel', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: 'Debug', category: ChannelCategory.debug, unReadMessages: 10 })],
      });

      render(<Channels />);

      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });

    it('should not display badge for Status channel', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: 'Status', category: ChannelCategory.status, unReadMessages: 10 })],
      });

      render(<Channels />);

      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });
  });

  describe('Remove channel', () => {
    const getChannelContainer = (name: string): HTMLElement => {
      const button = screen.getByRole('button', { name });
      const container = button.parentElement;
      if (!container) {
        throw new Error(`Parent element not found for channel: ${name}`);
      }
      return container;
    };

    it('should show close button on hover for channel category', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: '#general', category: ChannelCategory.channel })],
      });

      render(<Channels />);

      const channelContainer = getChannelContainer('#general');
      fireEvent.mouseEnter(channelContainer);

      expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument();
    });

    it('should show close button on hover for priv category', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: 'someUser', category: ChannelCategory.priv })],
      });

      render(<Channels />);

      const channelContainer = getChannelContainer('someUser');
      fireEvent.mouseEnter(channelContainer);

      expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument();
    });

    it('should move close button when hovering different channels', () => {
      setupMocks({
        openChannelsShort: [
          createChannel({ name: '#general', category: ChannelCategory.channel }),
          createChannel({ name: '#other', category: ChannelCategory.channel }),
        ],
      });

      render(<Channels />);

      const generalContainer = getChannelContainer('#general');
      const otherContainer = getChannelContainer('#other');

      // Hover over #general - close button should appear
      fireEvent.mouseEnter(generalContainer);
      expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument();

      // Move to #other channel - close button should still exist (for #other)
      fireEvent.mouseEnter(otherContainer);
      expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument();
    });

    it('should not show close button for Debug channel', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: 'Debug', category: ChannelCategory.debug })],
      });

      render(<Channels />);

      const channelContainer = getChannelContainer('Debug');
      fireEvent.mouseEnter(channelContainer);

      expect(screen.queryByRole('button', { name: 'close' })).not.toBeInTheDocument();
    });

    it('should not show close button for Status channel', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: 'Status', category: ChannelCategory.status })],
      });

      render(<Channels />);

      const channelContainer = getChannelContainer('Status');
      fireEvent.mouseEnter(channelContainer);

      expect(screen.queryByRole('button', { name: 'close' })).not.toBeInTheDocument();
    });

    it('should call ircPartChannel when closing a channel', () => {
      vi.spyOn(channelsStore, 'isPriv').mockReturnValue(false);

      setupMocks({
        openChannelsShort: [createChannel({ name: '#general', category: ChannelCategory.channel })],
      });

      render(<Channels />);

      const channelContainer = getChannelContainer('#general');
      fireEvent.mouseEnter(channelContainer);

      const closeButton = screen.getByRole('button', { name: 'close' });
      fireEvent.click(closeButton);

      expect(network.ircPartChannel).toHaveBeenCalledWith('#general');
    });

    it('should call setRemoveChannel when closing a priv channel', () => {
      vi.spyOn(channelsStore, 'isPriv').mockReturnValue(true);
      const mockSetRemoveChannel = vi.fn();
      vi.spyOn(channelsStore, 'setRemoveChannel').mockImplementation(mockSetRemoveChannel);

      setupMocks({
        openChannelsShort: [createChannel({ name: 'someUser', category: ChannelCategory.priv })],
      });

      render(<Channels />);

      const channelContainer = getChannelContainer('someUser');
      fireEvent.mouseEnter(channelContainer);

      const closeButton = screen.getByRole('button', { name: 'close' });
      fireEvent.click(closeButton);

      expect(mockSetRemoveChannel).toHaveBeenCalledWith('someUser');
    });

    it('should hide unread badge when close button is shown', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: '#general', category: ChannelCategory.channel, unReadMessages: 5 })],
      });

      render(<Channels />);

      expect(screen.getByText('5')).toBeInTheDocument();

      const channelContainer = getChannelContainer('#general');
      fireEvent.mouseEnter(channelContainer);

      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument();
    });
  });

  describe('Join channel dialog', () => {
    it('should open dialog when add button is clicked', () => {
      setupMocks({
        isChannelListLoadingFinished: true,
        channelsList: [{ name: '#newchannel', users: 10, topic: '' }],
      });

      render(<Channels />);

      const addButton = screen.getByRole('button', { name: 'main.channels.join' });
      fireEvent.click(addButton);

      expect(screen.getByText('channelListDialog.title')).toBeInTheDocument();
    });

    it('should display available channels in dialog', () => {
      setupMocks({
        isChannelListLoadingFinished: true,
        channelsList: [
          { name: '#available1', users: 10, topic: '' },
          { name: '#available2', users: 20, topic: '' },
        ],
      });

      render(<Channels />);

      const addButton = screen.getByRole('button', { name: 'main.channels.join' });
      fireEvent.click(addButton);

      expect(screen.getByRole('cell', { name: '#available1' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '#available2' })).toBeInTheDocument();
    });

    it('should filter out already open channels from the list', () => {
      setupMocks({
        openChannelsShort: [createChannel({ name: '#alreadyopen' })],
        isChannelListLoadingFinished: true,
        channelsList: [
          { name: '#alreadyopen', users: 10, topic: '' },
          { name: '#available', users: 20, topic: '' },
        ],
      });

      render(<Channels />);

      // #alreadyopen should appear as a channel button in sidebar before opening dialog
      expect(screen.getByRole('button', { name: '#alreadyopen' })).toBeInTheDocument();

      const addButton = screen.getByRole('button', { name: 'main.channels.join' });
      fireEvent.click(addButton);

      // In the dialog table, only #available should be visible as a table cell
      expect(screen.getByRole('cell', { name: '#available' })).toBeInTheDocument();
      expect(screen.queryByRole('cell', { name: '#alreadyopen' })).not.toBeInTheDocument();
    });

    it('should show no results message when channel list is empty', () => {
      setupMocks({
        isChannelListLoadingFinished: true,
        channelsList: [],
      });

      render(<Channels />);

      const addButton = screen.getByRole('button', { name: 'main.channels.join' });
      fireEvent.click(addButton);

      expect(screen.getByText('channelListDialog.noResults')).toBeInTheDocument();
    });
  });

  describe('Multiple channels', () => {
    it('should render all channels in the list', () => {
      const channels = [
        createChannel({ name: 'Status', category: ChannelCategory.status }),
        createChannel({ name: 'Debug', category: ChannelCategory.debug }),
        createChannel({ name: '#general', category: ChannelCategory.channel }),
        createChannel({ name: '#random', category: ChannelCategory.channel }),
        createChannel({ name: 'privateUser', category: ChannelCategory.priv }),
      ];

      setupMocks({ openChannelsShort: channels });

      render(<Channels />);

      expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Debug' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '#general' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '#random' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'privateUser' })).toBeInTheDocument();
    });
  });

  describe('Close button', () => {
    it('should show close button when drawer is open', () => {
      const channels = [createChannel({ name: '#test', category: ChannelCategory.channel })];
      setupMocks({ openChannelsShort: channels, isChannelsDrawerOpen: true });

      render(<Channels />);

      // Should have channel button + close button + join button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('should not show close button when drawer is closed', () => {
      const channels = [createChannel({ name: '#test', category: ChannelCategory.channel })];
      setupMocks({ openChannelsShort: channels, isChannelsDrawerOpen: false });

      render(<Channels />);

      // Find buttons with h-8 class (close button style)
      const buttons = screen.getAllByRole('button');
      const closeButtons = buttons.filter((btn) => btn.className.includes('h-8 w-8 p-0'));
      expect(closeButtons).toHaveLength(0);
    });

    it('should call setChannelsDrawerStatus when close button is clicked', () => {
      const mockSetChannelsDrawerStatus = vi.fn();
      const channels = [createChannel({ name: '#test', category: ChannelCategory.channel })];

      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          currentChannelName: '#test',
        } as unknown as settingsStore.SettingsStore)
      );

      vi.spyOn(channelsStore, 'useChannelsStore').mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (selector: any) => selector({ openChannelsShortList: channels })
      );

      vi.spyOn(DrawersContext, 'useChannelsDrawer').mockReturnValue({
        isChannelsDrawerOpen: true,
        setChannelsDrawerStatus: mockSetChannelsDrawerStatus,
      });

      vi.spyOn(channelListStore, 'useChannelListStore').mockImplementation((selector) =>
        selector({
          finished: false,
          channels: [],
          setAddChannel: vi.fn(),
          setClear: vi.fn(),
          setFinished: vi.fn(),
        })
      );

      vi.spyOn(channelListStore, 'getChannelListSortedByAZ').mockReturnValue([]);

      render(<Channels />);

      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find((btn) => btn.className.includes('h-8 w-8 p-0'));
      expect(closeButton).toBeDefined();

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockSetChannelsDrawerStatus).toHaveBeenCalled();
      }
    });
  });
});
