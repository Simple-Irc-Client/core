/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as chatHistoryFile from '@/network/irc/chatHistory';
import * as bouncerFile from '@/network/irc/bouncer';
import * as channelsFile from '@features/channels/store/channels';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageCategory } from '@shared/types';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';
import { createLabel } from '@/network/irc/labels';
import * as settingsFile from '@features/settings/store/settings';

describe('kernel ircv3/standardreplies', () => {
  setupKernelTest();

  it('stops asking for the history of a window the server refused it for', () => {
    const onHistoryFailed = vi.spyOn(chatHistoryFile, 'onHistoryFailed').mockImplementation(() => {});

    new Kernel({ type: 'raw', line: '@time=2026-10-22T06:51:42.985Z :ergo.test FAIL CHATHISTORY INVALID_TARGET BEFORE #nochan :Messages could not be retrieved' }).handle();

    expect(onHistoryFailed).toHaveBeenCalledExactlyOnceWith('#nochan');
  });

  it('shows why the bouncer refused, and lets a refused BIND pick the network again', () => {
    const onBouncerFailed = vi.spyOn(bouncerFile, 'onBouncerFailed').mockImplementation(() => {});
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    new Kernel({ type: 'raw', line: ':soju.test FAIL BOUNCER INVALID_NETID 77 :Unknown network ID' }).handle();

    expect(onBouncerFailed).toHaveBeenCalledOnce();
    expect(setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: STATUS_CHANNEL, message: 'Unknown network ID', category: MessageCategory.error }));
  });

  it('shows why a message could not be deleted, in the window the user deleted it from', () => {
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const label = createLabel({ window: '#sic' });

    new Kernel({ type: 'raw', line: `@label=${label} :ergo.test FAIL REDACT REDACT_FORBIDDEN #sic m1 :You are not authorized to delete this message` }).handle();

    expect(setAddMessage).toHaveBeenCalledWith(expect.objectContaining({
      target: '#sic',
      message: 'You are not authorized to delete this message',
      category: MessageCategory.error,
    }));
  });

  it('shows a refused deletion in the current window when the server does not label it', () => {
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockReturnValue('#current');

    new Kernel({ type: 'raw', line: ':ergo.test FAIL REDACT UNKNOWN_MSGID #sic m1 :This message does not exist or is too old' }).handle();

    expect(setAddMessage).toHaveBeenCalledWith(expect.objectContaining({ target: '#current', category: MessageCategory.error }));
  });

  it.each([
    ':ergo.test FAIL CHATHISTORY INVALID_PARAMS :Missing target',
    ':ergo.test FAIL MARKREAD INVALID_PARAMS garbage :Invalid timestamp',
    ':ergo.test FAIL',
  ])('ignores a failure it has nothing to do with: %s', (line) => {
    const onHistoryFailed = vi.spyOn(chatHistoryFile, 'onHistoryFailed').mockImplementation(() => {});

    new Kernel({ type: 'raw', line }).handle();

    expect(onHistoryFailed).not.toHaveBeenCalled();
  });
});
