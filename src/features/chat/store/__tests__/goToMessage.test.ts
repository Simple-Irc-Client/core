import { beforeEach, describe, expect, it } from 'vitest';
import { clearGoToMessage, goToMessage, useGoToMessageStore } from '../goToMessage';
import { useCurrentStore } from '../current';
import { useChannelsStore } from '@features/channels/store/channels';
import { useSettingsStore } from '@features/settings/store/settings';
import { ChannelCategory, MessageCategory } from '@shared/types';

describe('goToMessage', () => {
  beforeEach(() => {
    useSettingsStore.setState({ currentChannelName: '#home', currentChannelCategory: ChannelCategory.channel });
    useChannelsStore.getState().setClearAll();
    useChannelsStore.getState().setAddChannel('alice', ChannelCategory.priv);
    useChannelsStore.getState().setAddMessage({ id: 'm1', message: 'hi', target: 'alice', time: '2024-01-01T12:00:00Z', category: MessageCategory.default }, 100);
    clearGoToMessage();
  });

  it('should show the message\'s window and ask for the message', () => {
    goToMessage('alice', ChannelCategory.priv, 'm1');

    expect(useSettingsStore.getState().currentChannelName).toBe('alice');
    expect(useSettingsStore.getState().currentChannelCategory).toBe(ChannelCategory.priv);
    expect(useCurrentStore.getState().messages.map(({ id }) => id)).toEqual(['m1']);
    expect(useGoToMessageStore.getState().sought).toEqual({ channelName: 'alice', messageId: 'm1' });
  });

  it('should forget the message once cleared', () => {
    goToMessage('alice', ChannelCategory.priv, 'm1');
    clearGoToMessage();

    expect(useGoToMessageStore.getState().sought).toBeUndefined();
  });
});
