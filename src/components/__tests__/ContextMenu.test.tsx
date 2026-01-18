import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ContextMenu } from '../ContextMenu';
import * as ContextMenuContext from '../../providers/ContextMenuContext';
import * as settings from '../../store/settings';
import * as users from '../../store/users';
import * as channels from '../../store/channels';
import * as network from '../../network/irc/network';
import { ChannelCategory } from '../../types';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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
});
