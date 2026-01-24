import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelSettingsButton from '../ChannelSettingsButton';
import * as usersStore from '@features/users/store/users';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@shared/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span data-testid="tooltip-content">{children}</span>,
}));

vi.mock('@shared/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@shared/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

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
      setIsLoading: vi.fn(),
      setActiveTab: vi.fn(),
      setActiveListType: vi.fn(),
      setChannelName: vi.fn(),
      setBanList: vi.fn(),
      setExceptionList: vi.fn(),
      setInviteList: vi.fn(),
      setIsBanListLoading: vi.fn(),
      setIsExceptionListLoading: vi.fn(),
      setIsInviteListLoading: vi.fn(),
    })
  ),
  clearChannelSettingsStore: vi.fn(),
}));

vi.mock('@features/settings/store/settings', () => ({
  useSettingsStore: vi.fn((selector) =>
    selector({
      channelModes: { A: ['b', 'e', 'I'], B: ['k'], C: ['l'], D: ['n', 't', 'i', 'm', 's', 'p'] },
      userModes: [
        { symbol: '~', flag: 'q' },
        { symbol: '&', flag: 'a' },
        { symbol: '@', flag: 'o' },
        { symbol: '%', flag: 'h' },
        { symbol: '+', flag: 'v' },
      ],
      nick: 'testuser',
    })
  ),
}));

describe('ChannelSettingsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('should render button for operators', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['o']);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.getByTestId('channel-settings-button')).toBeInTheDocument();
    });

    it('should render button for half-ops', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['h']);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.getByTestId('channel-settings-button')).toBeInTheDocument();
    });

    it('should render button for admins', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['a']);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.getByTestId('channel-settings-button')).toBeInTheDocument();
    });

    it('should render button for owners', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['q']);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.getByTestId('channel-settings-button')).toBeInTheDocument();
    });

    it('should not render button for voice-only users', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['v']);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.queryByTestId('channel-settings-button')).not.toBeInTheDocument();
    });

    it('should not render button for regular users', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue([]);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.queryByTestId('channel-settings-button')).not.toBeInTheDocument();
    });

    it('should render button for users with multiple flags including op', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['v', 'o']);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.getByTestId('channel-settings-button')).toBeInTheDocument();
    });
  });

  describe('dialog interaction', () => {
    it('should open dialog when button is clicked', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['o']);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('channel-settings-button'));

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  describe('tooltip', () => {
    it('should show tooltip with correct translation key', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['o']);

      render(<ChannelSettingsButton channelName="#test" />);

      expect(screen.getByTestId('tooltip-content')).toHaveTextContent('channelSettings.button.tooltip');
    });
  });
});
