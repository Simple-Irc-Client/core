import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ContextMenu, getMenuPosition } from '../ContextMenu';
import * as ContextMenuContext from '@/providers/ContextMenuContext';
import * as settings from '@features/settings/store/settings';
import * as users from '@features/users/store/users';
import * as channels from '@features/channels/store/channels';
import * as network from '@/network/irc/network';
import { ChannelCategory } from '@shared/types';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

describe('ContextMenu', () => {
  const mockHandleContextMenuClose = vi.fn();
  const mockHandleContextMenuUserClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createContextMenuMock = (overrides = {}) => ({
    contextMenuOpen: true,
    handleContextMenuClose: mockHandleContextMenuClose,
    contextMenuAnchorElement: null,
    contextMenuCategory: 'user' as const,
    contextMenuItem: 'testUser',
    handleContextMenuUserClick: mockHandleContextMenuUserClick,
    contextMenuPosition: null,
    ...overrides,
  });

  describe('Basic rendering', () => {
    it('should not render menu when category is not user', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuCategory: '' })
      );

      const { container } = render(<ContextMenu />);
      // Empty fragment is rendered
      expect(container.innerHTML).toBe('');
    });

    it('should not render menu when contextMenuItem is undefined', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: undefined })
      );

      const { container } = render(<ContextMenu />);
      expect(container.innerHTML).toBe('');
    });

    it('should render menu with user label when valid', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock()
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      // Menu renders into portal (document.body)
      expect(document.body.textContent).toContain('testUser');
    });
  });

  describe('Self-exclusion for Priv option', () => {
    it('should not show Priv option for current user', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'currentUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.priv');
    });

    it('should show Priv option for other users', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.user.priv');
    });
  });

  describe('Add Friend functionality', () => {
    it('should not show Add Friend when user is not registered', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]); // No +r flag
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(10);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.addfriend');
    });

    it('should not show Add Friend when server does not support WATCH or MONITOR', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue(['r']);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.addfriend');
    });

    it('should show Add Friend when user is registered and MONITOR is supported', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue(['r']);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(128);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.user.addfriend');
    });

    it('should not show Add Friend for current user', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'currentUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue(['r']);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(10);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(128);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.addfriend');
    });
  });

  describe('Ignore functionality', () => {
    it('should not show Ignore when user is not registered', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(15);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.ignore');
    });

    it('should show Ignore when user is registered and SILENCE is supported', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue(['r']);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(15);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.user.ignore');
    });

    it('should not show Ignore for current user', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'currentUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue(['r']);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(15);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.ignore');
    });
  });

  describe('Operator actions visibility', () => {
    it('should not show operator actions when not in a channel', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.operator.title');
    });

    it('should show operator actions when current user has half-op or higher', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.channel);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('#test');
      vi.spyOn(users, 'getCurrentUserChannelModes').mockReturnValue(['h']);
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'otherUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [{ name: '#test', flags: [], maxPermission: 0 }],
      });

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.user.operator.title');
    });
  });

  describe('Kick/Ban self-exclusion', () => {
    it('should not show kick/ban options for current user', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'currentUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.channel);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('#test');
      vi.spyOn(users, 'getCurrentUserChannelModes').mockReturnValue(['o']);
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'currentUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [{ name: '#test', flags: ['o'], maxPermission: 3 }],
      });

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.operator.kick');
      expect(document.body.textContent).not.toContain('contextmenu.user.operator.ban');
      expect(document.body.textContent).not.toContain('contextmenu.user.operator.kickban');
    });

    it('should show operator actions menu for other users when permissions allow', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.channel);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('#test');
      vi.spyOn(users, 'getCurrentUserChannelModes').mockReturnValue(['o']);
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'otherUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [{ name: '#test', flags: [], maxPermission: 0 }],
      });

      render(<ContextMenu />);
      // Operator submenu is shown (kick/ban options are inside the closed submenu)
      expect(document.body.textContent).toContain('contextmenu.user.operator.title');
    });
  });

  describe('Whois option', () => {
    it('should always show Whois option', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'anyUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.user.whois');
    });
  });

  describe('Visit Homepage option', () => {
    it('should show Visit Homepage when user has homepage', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'otherUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [],
        homepage: 'https://example.com',
      });

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.user.homepage');
    });

    it('should open window when homepage is a safe URL', () => {
      const mockWindowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'otherUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [],
        homepage: 'https://example.com',
      });

      render(<ContextMenu />);
      const homepageButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.homepage'));
      expect(homepageButton).toBeDefined();
      if (homepageButton) fireEvent.click(homepageButton);

      expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    });

    it('should not open window when homepage is a javascript: URL', () => {
      const mockWindowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'otherUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [],
        homepage: 'javascript:alert(1)',
      });

      render(<ContextMenu />);
      const homepageButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.homepage'));
      expect(homepageButton).toBeDefined();
      if (homepageButton) fireEvent.click(homepageButton);

      expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it('should not open window when homepage is a data: URL', () => {
      const mockWindowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'otherUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [],
        homepage: 'data:text/html,<script>alert(1)</script>',
      });

      render(<ContextMenu />);
      const homepageButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.homepage'));
      expect(homepageButton).toBeDefined();
      if (homepageButton) fireEvent.click(homepageButton);

      expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it('should not show Visit Homepage when user has no homepage', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'otherUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [],
      });

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.homepage');
    });
  });

  describe('Invite to channel functionality', () => {
    const createChannelsStoreMock = (openChannelsShortList: { name: string; category: ChannelCategory; unReadMessages: number }[]) => {
      return (selector: (state: { openChannelsShortList: typeof openChannelsShortList }) => unknown) => {
        const state = { openChannelsShortList };
        return selector(state);
      };
    };

    it('should show Invite option when user has channels and target is not current user', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(channels, 'useChannelsStore').mockImplementation(createChannelsStoreMock([
        { name: '#channel1', category: ChannelCategory.channel, unReadMessages: 0 },
        { name: '#channel2', category: ChannelCategory.channel, unReadMessages: 0 },
      ]) as typeof channels.useChannelsStore);

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.user.invite');
    });

    it('should not show Invite option for current user', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'currentUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(channels, 'useChannelsStore').mockImplementation(createChannelsStoreMock([
        { name: '#channel1', category: ChannelCategory.channel, unReadMessages: 0 },
      ]) as typeof channels.useChannelsStore);

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.invite');
    });

    it('should not show Invite option when user has no channels', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(channels, 'useChannelsStore').mockImplementation(createChannelsStoreMock([]) as typeof channels.useChannelsStore);

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.invite');
    });

    it('should not show Invite option when user only has private chats (no channels)', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(channels, 'useChannelsStore').mockImplementation(createChannelsStoreMock([
        { name: 'someUser', category: ChannelCategory.priv, unReadMessages: 0 },
        { name: 'Status', category: ChannelCategory.status, unReadMessages: 0 },
      ]) as typeof channels.useChannelsStore);

      render(<ContextMenu />);
      expect(document.body.textContent).not.toContain('contextmenu.user.invite');
    });
  });

  describe('Channel context menu', () => {
    const createChannelContextMenuMock = (overrides = {}) => ({
      contextMenuOpen: true,
      handleContextMenuClose: mockHandleContextMenuClose,
      contextMenuAnchorElement: null,
      contextMenuCategory: 'channel' as const,
      contextMenuItem: '#testchannel',
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
      contextMenuPosition: null,
      ...overrides,
    });

    it('should render channel menu when category is channel', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChannelContextMenuMock()
      );

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('#testchannel');
    });

    it('should show Join option for channel', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChannelContextMenuMock()
      );

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.channel.join');
    });

    it('should not render channel menu when contextMenuItem is undefined', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChannelContextMenuMock({ contextMenuItem: undefined })
      );

      const { container } = render(<ContextMenu />);
      expect(container.innerHTML).toBe('');
    });

    it('should call ircSendRawMessage with JOIN command when Join is clicked', () => {
      const mockIrcSendRawMessage = vi.spyOn(network, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChannelContextMenuMock({ contextMenuItem: '#mychannel' })
      );

      render(<ContextMenu />);
      const joinButton = document.body.querySelector('[role="menuitem"]');
      expect(joinButton).not.toBeNull();
      if (joinButton) fireEvent.click(joinButton);

      expect(mockIrcSendRawMessage).toHaveBeenCalledWith('JOIN #mychannel');
      expect(mockHandleContextMenuClose).toHaveBeenCalled();
    });

    it('should handle channel names with different prefixes', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChannelContextMenuMock({ contextMenuItem: '&localchannel' })
      );

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('&localchannel');
      expect(document.body.textContent).toContain('contextmenu.channel.join');
    });
  });

  describe('Private message user list population', () => {
    const createChannelsStoreMock = (openChannelsShortList: { name: string; category: ChannelCategory; unReadMessages: number }[]) => {
      return (selector: (state: { openChannelsShortList: typeof openChannelsShortList }) => unknown) => {
        const state = { openChannelsShortList };
        return selector(state);
      };
    };

    it('should add both users to channel when clicking Priv - users do not exist', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(channels, 'useChannelsStore').mockImplementation(createChannelsStoreMock([]) as typeof channels.useChannelsStore);

      // Users don't exist
      vi.spyOn(users, 'getHasUser').mockReturnValue(false);
      const mockSetAddUser = vi.spyOn(users, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(users, 'setJoinUser').mockImplementation(() => {});
      const mockSetAddChannel = vi.spyOn(channels, 'setAddChannel').mockImplementation(() => {});

      render(<ContextMenu />);

      // Click the Priv option
      const privButton = document.body.querySelector('[role="menuitem"]');
      expect(privButton?.textContent).toContain('contextmenu.user.priv');
      if (privButton) fireEvent.click(privButton);

      // Should create the priv channel
      expect(mockSetAddChannel).toHaveBeenCalledWith('otherUser', ChannelCategory.priv);

      // Should add both users since they don't exist
      expect(mockSetAddUser).toHaveBeenCalledWith(
        expect.objectContaining({
          nick: 'otherUser',
          channels: [expect.objectContaining({ name: 'otherUser' })],
        })
      );
      expect(mockSetAddUser).toHaveBeenCalledWith(
        expect.objectContaining({
          nick: 'currentUser',
          channels: [expect.objectContaining({ name: 'otherUser' })],
        })
      );
      expect(mockSetJoinUser).not.toHaveBeenCalled();
    });

    it('should use setJoinUser when users already exist', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(channels, 'useChannelsStore').mockImplementation(createChannelsStoreMock([]) as typeof channels.useChannelsStore);

      // Users already exist
      vi.spyOn(users, 'getHasUser').mockReturnValue(true);
      const mockSetAddUser = vi.spyOn(users, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(users, 'setJoinUser').mockImplementation(() => {});
      vi.spyOn(channels, 'setAddChannel').mockImplementation(() => {});

      render(<ContextMenu />);

      // Click the Priv option
      const privButton = document.body.querySelector('[role="menuitem"]');
      if (privButton) fireEvent.click(privButton);

      // Should use setJoinUser since users exist
      expect(mockSetJoinUser).toHaveBeenCalledWith('otherUser', 'otherUser');
      expect(mockSetJoinUser).toHaveBeenCalledWith('currentUser', 'otherUser');
      expect(mockSetAddUser).not.toHaveBeenCalled();
    });

    it('should handle mixed case where one user exists and one does not', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'otherUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.status);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('');
      vi.spyOn(channels, 'useChannelsStore').mockImplementation(createChannelsStoreMock([]) as typeof channels.useChannelsStore);

      // otherUser exists, currentUser does not
      vi.spyOn(users, 'getHasUser').mockImplementation((nick: string) => nick === 'otherUser');
      const mockSetAddUser = vi.spyOn(users, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(users, 'setJoinUser').mockImplementation(() => {});
      vi.spyOn(channels, 'setAddChannel').mockImplementation(() => {});

      render(<ContextMenu />);

      // Click the Priv option
      const privButton = document.body.querySelector('[role="menuitem"]');
      if (privButton) fireEvent.click(privButton);

      // otherUser exists, so use setJoinUser
      expect(mockSetJoinUser).toHaveBeenCalledWith('otherUser', 'otherUser');

      // currentUser doesn't exist, so use setAddUser
      expect(mockSetAddUser).toHaveBeenCalledWith(
        expect.objectContaining({
          nick: 'currentUser',
          channels: [expect.objectContaining({ name: 'otherUser' })],
        })
      );
    });
  });

  describe('Text context menu (Copy)', () => {
    const createTextContextMenuMock = (overrides = {}) => ({
      contextMenuOpen: true,
      handleContextMenuClose: mockHandleContextMenuClose,
      contextMenuAnchorElement: null,
      contextMenuCategory: 'text' as const,
      contextMenuItem: 'selected text content',
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
      contextMenuPosition: { x: 100, y: 200 },
      ...overrides,
    });

    it('should render Copy option when category is text', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createTextContextMenuMock()
      );

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.text.copy');
    });

    it('should not render text menu when contextMenuItem is undefined', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createTextContextMenuMock({ contextMenuItem: undefined })
      );

      const { container } = render(<ContextMenu />);
      expect(container.innerHTML).toBe('');
    });

    it('should copy text to clipboard when Copy is clicked', () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createTextContextMenuMock({ contextMenuItem: 'hello world' })
      );

      render(<ContextMenu />);
      const copyButton = document.body.querySelector('[role="menuitem"]');
      expect(copyButton).not.toBeNull();
      if (copyButton) fireEvent.click(copyButton);

      expect(mockWriteText).toHaveBeenCalledWith('hello world');
      expect(mockHandleContextMenuClose).toHaveBeenCalled();
    });

    it('should position menu at contextMenuPosition coordinates', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createTextContextMenuMock({ contextMenuPosition: { x: 150, y: 300 } })
      );

      render(<ContextMenu />);
      const menuContent = document.body.querySelector('[role="menu"]');
      expect(menuContent).toHaveStyle({ position: 'fixed', left: '150px', top: '300px' });
    });
  });

  describe('URL context menu', () => {
    const createUrlContextMenuMock = (overrides = {}) => ({
      contextMenuOpen: true,
      handleContextMenuClose: mockHandleContextMenuClose,
      contextMenuAnchorElement: null,
      contextMenuCategory: 'url' as const,
      contextMenuItem: 'https://example.com',
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
      contextMenuPosition: { x: 100, y: 200 },
      ...overrides,
    });

    it('should render Open and Copy URL options when category is url', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createUrlContextMenuMock()
      );

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.url.open');
      expect(document.body.textContent).toContain('contextmenu.url.copy');
    });

    it('should show truncated URL as label', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createUrlContextMenuMock()
      );

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('https://example.com');
    });

    it('should truncate long URLs in the label', () => {
      const longUrl = 'https://example.com/very/long/path/that/exceeds/fifty/characters/in/total';
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createUrlContextMenuMock({ contextMenuItem: longUrl })
      );

      render(<ContextMenu />);
      expect(document.body.textContent).toContain(longUrl.substring(0, 50) + '...');
    });

    it('should not render url menu when contextMenuItem is undefined', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createUrlContextMenuMock({ contextMenuItem: undefined })
      );

      const { container } = render(<ContextMenu />);
      expect(container.innerHTML).toBe('');
    });

    it('should open URL in new tab when Open is clicked', () => {
      const mockWindowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createUrlContextMenuMock({ contextMenuItem: 'https://example.com' })
      );

      render(<ContextMenu />);
      const openButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.url.open'));
      expect(openButton).toBeDefined();
      if (openButton) fireEvent.click(openButton);

      expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
      expect(mockHandleContextMenuClose).toHaveBeenCalled();
    });

    it('should not open unsafe URLs', () => {
      const mockWindowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createUrlContextMenuMock({ contextMenuItem: 'javascript:alert(1)' })
      );

      render(<ContextMenu />);
      const openButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.url.open'));
      if (openButton) fireEvent.click(openButton);

      expect(mockWindowOpen).not.toHaveBeenCalled();
      expect(mockHandleContextMenuClose).toHaveBeenCalled();
    });

    it('should copy URL to clipboard when Copy URL is clicked', () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createUrlContextMenuMock({ contextMenuItem: 'https://example.com/path' })
      );

      render(<ContextMenu />);
      const copyButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.url.copy'));
      expect(copyButton).toBeDefined();
      if (copyButton) fireEvent.click(copyButton);

      expect(mockWriteText).toHaveBeenCalledWith('https://example.com/path');
      expect(mockHandleContextMenuClose).toHaveBeenCalled();
    });

    it('should position menu at contextMenuPosition coordinates', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createUrlContextMenuMock({ contextMenuPosition: { x: 300, y: 450 } })
      );

      render(<ContextMenu />);
      const menuContent = document.body.querySelector('[role="menu"]');
      expect(menuContent).toHaveStyle({ position: 'fixed', left: '300px', top: '450px' });
    });
  });

  describe('getMenuPosition', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
    });

    describe('with coordinate source', () => {
      it('should return coordinates directly when within bounds', () => {
        const result = getMenuPosition({ x: 100, y: 200 }, 200, 200);
        expect(result).toEqual({ left: 100, top: 200 });
      });

      it('should clamp left when menu would overflow right edge', () => {
        const result = getMenuPosition({ x: 900, y: 200 }, 200, 200);
        expect(result).toEqual({ left: 824, top: 200 });
      });

      it('should clamp top when menu would overflow bottom edge', () => {
        const result = getMenuPosition({ x: 100, y: 700 }, 200, 200);
        expect(result).toEqual({ left: 100, top: 568 });
      });

      it('should clamp both axes when near bottom-right corner', () => {
        const result = getMenuPosition({ x: 950, y: 700 }, 200, 200);
        expect(result).toEqual({ left: 824, top: 568 });
      });

      it('should clamp negative coordinates to zero', () => {
        const result = getMenuPosition({ x: -50, y: -30 }, 200, 200);
        expect(result).toEqual({ left: 0, top: 0 });
      });
    });

    describe('with HTMLElement source', () => {
      const createElement = (rect: Partial<DOMRect>) => {
        const el = document.createElement('div');
        el.getBoundingClientRect = () => ({
          top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
          toJSON: () => {},
          ...rect,
        });
        return el;
      };

      it('should position below element when enough space', () => {
        const el = createElement({ left: 100, top: 200, bottom: 230 });
        const result = getMenuPosition(el, 200, 200);
        expect(result).toEqual({ left: 100, top: 230 });
      });

      it('should position above element when not enough space below', () => {
        const el = createElement({ left: 100, top: 600, bottom: 630 });
        const result = getMenuPosition(el, 200, 200);
        expect(result).toEqual({ left: 100, top: 400 });
      });

      it('should clamp left when element is near right edge', () => {
        const el = createElement({ left: 900, top: 100, bottom: 130 });
        const result = getMenuPosition(el, 200, 200);
        expect(result).toEqual({ left: 824, top: 130 });
      });

      it('should clamp top to zero when positioned above but near top of viewport', () => {
        const el = createElement({ left: 100, top: 50, bottom: 80 });
        // spaceBelow = 768 - 80 = 688 (enough), so positions below
        const result = getMenuPosition(el, 200, 200);
        expect(result).toEqual({ left: 100, top: 80 });
      });

      it('should prefer below when space below equals space above', () => {
        // top: 384, bottom: 384 → spaceBelow = 384, spaceAbove = 384
        // spaceBelow < menuHeight (384 < 400) AND spaceAbove > spaceBelow is false (equal)
        // → positions below
        const el = createElement({ left: 100, top: 384, bottom: 384 });
        const result = getMenuPosition(el, 200, 400);
        // top=384 gets clamped to 768-400=368
        expect(result).toEqual({ left: 100, top: 368 });
      });
    });
  });

  describe('Chat context menu (Clear Screen)', () => {
    const createChatContextMenuMock = (overrides = {}) => ({
      contextMenuOpen: true,
      handleContextMenuClose: mockHandleContextMenuClose,
      contextMenuAnchorElement: null,
      contextMenuCategory: 'chat' as const,
      contextMenuItem: '#test',
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
      contextMenuPosition: { x: 100, y: 200 },
      ...overrides,
    });

    it('should render Clear Screen option when category is chat', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChatContextMenuMock()
      );

      render(<ContextMenu />);
      expect(document.body.textContent).toContain('contextmenu.chat.clear');
    });

    it('should not render chat menu when contextMenuItem is undefined', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChatContextMenuMock({ contextMenuItem: undefined })
      );

      const { container } = render(<ContextMenu />);
      expect(container.innerHTML).toBe('');
    });

    it('should call setClearMessages when Clear Screen is clicked', () => {
      const mockSetClearMessages = vi.spyOn(channels, 'setClearMessages').mockImplementation(() => {});

      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChatContextMenuMock({ contextMenuItem: '#mychannel' })
      );

      render(<ContextMenu />);
      const clearButton = document.body.querySelector('[role="menuitem"]');
      expect(clearButton).not.toBeNull();
      if (clearButton) fireEvent.click(clearButton);

      expect(mockSetClearMessages).toHaveBeenCalledWith('#mychannel');
      expect(mockHandleContextMenuClose).toHaveBeenCalled();
    });

    it('should position menu at contextMenuPosition coordinates', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createChatContextMenuMock({ contextMenuPosition: { x: 250, y: 400 } })
      );

      render(<ContextMenu />);
      const menuContent = document.body.querySelector('[role="menu"]');
      expect(menuContent).toHaveStyle({ position: 'fixed', left: '250px', top: '400px' });
    });
  });

  describe('Unhappy paths', () => {
    it('should render nothing when contextMenuCategory is an unknown value', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuCategory: 'unknown_type' })
      );

      const { container } = render(<ContextMenu />);
      expect(container.innerHTML).toBe('');
    });

    it('should not crash when getUser returns undefined for departed user during ban', () => {
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'departedUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.channel);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('#test');
      vi.spyOn(users, 'getCurrentUserChannelModes').mockReturnValue(['o']);
      // User has departed - getUser returns undefined
      vi.spyOn(users, 'getUser').mockReturnValue(undefined);

      render(<ContextMenu />);
      // Operator menu should still render (hasOperatorActions depends on currentLevel)
      expect(document.body.textContent).toContain('contextmenu.user.operator.title');
    });

    it('should send KICK command with correct channel and nick', () => {
      const mockIrcSendRawMessage = vi.spyOn(network, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'targetUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.channel);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('#ops');
      vi.spyOn(users, 'getCurrentUserChannelModes').mockReturnValue(['o']);
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'targetUser',
        ident: 'user',
        hostname: 'example.com',
        flags: [],
        channels: [{ name: '#ops', flags: [], maxPermission: 0 }],
      });

      render(<ContextMenu />);

      // Open operator submenu and click Kick
      const operatorTrigger = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.operator.title'));
      if (operatorTrigger) fireEvent.click(operatorTrigger);

      const kickButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.operator.kick'));
      if (kickButton) fireEvent.click(kickButton);

      expect(mockIrcSendRawMessage).toHaveBeenCalledWith('KICK #ops targetUser');
    });

    it('should send BAN command with host-based mask', () => {
      const mockIrcSendRawMessage = vi.spyOn(network, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'targetUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.channel);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('#ops');
      vi.spyOn(users, 'getCurrentUserChannelModes').mockReturnValue(['o']);
      vi.spyOn(users, 'getUser').mockReturnValue({
        nick: 'targetUser',
        ident: 'user',
        hostname: 'bad.host.com',
        flags: [],
        channels: [{ name: '#ops', flags: [], maxPermission: 0 }],
      });

      render(<ContextMenu />);

      const operatorTrigger = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.operator.title'));
      if (operatorTrigger) fireEvent.click(operatorTrigger);

      const banButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.operator.ban'));
      if (banButton) fireEvent.click(banButton);

      expect(mockIrcSendRawMessage).toHaveBeenCalledWith('MODE #ops +b *!*@bad.host.com');
    });

    it('should not send BAN command when getUser returns undefined', () => {
      const mockIrcSendRawMessage = vi.spyOn(network, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue(
        createContextMenuMock({ contextMenuItem: 'departedUser' })
      );
      vi.spyOn(settings, 'getCurrentNick').mockReturnValue('currentUser');
      vi.spyOn(settings, 'getCurrentUserFlags').mockReturnValue([]);
      vi.spyOn(settings, 'getWatchLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getMonitorLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getSilenceLimit').mockReturnValue(0);
      vi.spyOn(settings, 'getCurrentChannelCategory').mockReturnValue(ChannelCategory.channel);
      vi.spyOn(settings, 'getCurrentChannelName').mockReturnValue('#ops');
      vi.spyOn(users, 'getCurrentUserChannelModes').mockReturnValue(['o']);
      vi.spyOn(users, 'getUser').mockReturnValue(undefined);

      render(<ContextMenu />);

      const operatorTrigger = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.operator.title'));
      if (operatorTrigger) fireEvent.click(operatorTrigger);

      const banButton = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
        .find(el => el.textContent?.includes('contextmenu.user.operator.ban'));
      if (banButton) fireEvent.click(banButton);

      // Ban should NOT send MODE since user is undefined (no hostname to create mask)
      expect(mockIrcSendRawMessage).not.toHaveBeenCalledWith(expect.stringContaining('MODE'));
    });
  });
});
