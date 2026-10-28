import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChannelCategory } from '@shared/types';
import { setClearUnreadMessages } from '@features/channels/store/channels';
import { markRead } from '@/network/irc/readMarkers';
import { getCurrentChannelCategory, getCurrentChannelName } from '../store/networks';
import { setCurrentChannelName } from '../currentChannel';
import { connectTestNetwork, resetNetworks } from '@/test/networks';

vi.mock('@features/channels/store/channels', () => ({
  getMessages: vi.fn(() => []),
  getTopic: vi.fn(() => ''),
  getTyping: vi.fn(() => []),
  setClearUnreadMessages: vi.fn(),
}));

vi.mock('@features/users/store/users', () => ({
  flushCurrentUsers: vi.fn(),
}));

vi.mock('@/network/irc/readMarkers', () => ({
  markRead: vi.fn(),
}));

describe('setCurrentChannelName', () => {
  beforeEach(() => {
    resetNetworks();
    connectTestNetwork();
    vi.clearAllMocks();
  });

  it('switches the window, and marks it as read here and on the server', () => {
    setCurrentChannelName('#chan', ChannelCategory.channel);

    expect(getCurrentChannelName()).toBe('#chan');
    expect(getCurrentChannelCategory()).toBe(ChannelCategory.channel);
    expect(setClearUnreadMessages).toHaveBeenCalledWith('#chan');
    expect(markRead).toHaveBeenCalledWith('#chan');
  });
});
