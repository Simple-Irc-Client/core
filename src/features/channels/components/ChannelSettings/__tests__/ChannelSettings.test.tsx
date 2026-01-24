import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelSettings from '../ChannelSettings';
import * as network from '@/network/irc/network';
import * as channelSettingsStore from '@features/channels/store/channelSettings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'channelSettings.title' && params?.channel) {
        return `Channel Settings - ${params.channel}`;
      }
      return key;
    },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@shared/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) => (
    open ? (
      <div data-testid="dialog">
        <button data-testid="close-button" onClick={() => onOpenChange(false)}>Close</button>
        {children}
      </div>
    ) : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p data-testid="dialog-description">{children}</p>,
}));

vi.mock('@shared/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (v: string) => void }) => (
    <div data-testid="tabs" data-value={value}>{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value, ...props }: { children: React.ReactNode; value: string }) => (
    <button data-testid={`tab-${value}`} {...props}>{children}</button>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

const mockSetChannelName = vi.fn();
const mockSetIsLoading = vi.fn();
const mockSetBanList = vi.fn();
const mockSetExceptionList = vi.fn();
const mockSetInviteList = vi.fn();
const mockSetIsBanListLoading = vi.fn();
const mockSetIsExceptionListLoading = vi.fn();
const mockSetIsInviteListLoading = vi.fn();
const mockSetActiveTab = vi.fn();

vi.mock('@features/channels/store/channelSettings', () => ({
  useChannelSettingsStore: vi.fn((selector) =>
    selector({
      isLoading: false,
      activeTab: 'modes',
      activeListType: 'b',
      channelName: '#test',
      channelModes: {},
      banList: [],
      exceptionList: [],
      inviteList: [],
      isBanListLoading: false,
      isExceptionListLoading: false,
      isInviteListLoading: false,
      setIsLoading: mockSetIsLoading,
      setActiveTab: mockSetActiveTab,
      setActiveListType: vi.fn(),
      setChannelName: mockSetChannelName,
      setBanList: mockSetBanList,
      setExceptionList: mockSetExceptionList,
      setInviteList: mockSetInviteList,
      setIsBanListLoading: mockSetIsBanListLoading,
      setIsExceptionListLoading: mockSetIsExceptionListLoading,
      setIsInviteListLoading: mockSetIsInviteListLoading,
    })
  ),
  clearChannelSettingsStore: vi.fn(),
}));

vi.mock('@features/settings/store/settings', () => ({
  useSettingsStore: vi.fn((selector) =>
    selector({
      channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
      userModes: [],
      nick: 'testuser',
    })
  ),
}));

vi.mock('@features/users/store/users', () => ({
  getUsersFromChannelSortedByMode: vi.fn(() => []),
  getCurrentUserChannelModes: vi.fn(() => ['o']),
}));

describe('ChannelSettings', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    channelName: '#test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render dialog when closed', () => {
      render(<ChannelSettings {...defaultProps} open={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should render dialog when open', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('should render dialog title with channel name', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Channel Settings - #test');
    });

    it('should render all tab triggers', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(screen.getByTestId('tab-modes')).toBeInTheDocument();
      expect(screen.getByTestId('tab-lists')).toBeInTheDocument();
      expect(screen.getByTestId('tab-users')).toBeInTheDocument();
    });
  });

  describe('data fetching on open', () => {
    it('should set channel name when dialog opens', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(mockSetChannelName).toHaveBeenCalledWith('#test');
    });

    it('should set loading state when dialog opens', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    });

    it('should query channel modes when dialog opens', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test');
    });

    it('should query ban list when dialog opens', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test b');
    });

    it('should query exception list when dialog opens', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test e');
    });

    it('should query invite list when dialog opens', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test I');
    });

    it('should clear lists before fetching', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(mockSetBanList).toHaveBeenCalledWith([]);
      expect(mockSetExceptionList).toHaveBeenCalledWith([]);
      expect(mockSetInviteList).toHaveBeenCalledWith([]);
    });

    it('should set list loading states', () => {
      render(<ChannelSettings {...defaultProps} />);

      expect(mockSetIsBanListLoading).toHaveBeenCalledWith(true);
      expect(mockSetIsExceptionListLoading).toHaveBeenCalledWith(true);
      expect(mockSetIsInviteListLoading).toHaveBeenCalledWith(true);
    });
  });

  describe('closing dialog', () => {
    it('should call clearChannelSettingsStore when dialog closes', () => {
      render(<ChannelSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('close-button'));

      expect(channelSettingsStore.clearChannelSettingsStore).toHaveBeenCalled();
    });

    it('should call onOpenChange when dialog closes', () => {
      render(<ChannelSettings {...defaultProps} />);

      fireEvent.click(screen.getByTestId('close-button'));

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
