import i18next from '@/app/i18n';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { clearChannelWhoRequests } from '@/network/irc/kernel/core/who';
import { clearSavedCredentials, getIsReconnecting, handleReconnectFailure, ircConnectWithTLS, ircJoinChannels, ircSendRawMessage, resetInactivityReconnectRetries, startKeepalive, stopKeepalive } from '@/network/irc/network';
import { clearLabels } from '@/network/irc/labels';
import { clearSaslCredentials, getNickServFallbackCredentials, restoreSaslCredentials } from '@/network/irc/sasl';
import { clearPendingSTSUpgrade, getPendingSTSUpgrade, hasExhaustedSTSRetries, incrementSTSRetries, resetSTSRetries } from '@/network/irc/sts';
import { clearAllTyping, existChannel, getChannelsToAutoJoin, setAddChannel, setAddMessage, setAddMessageToAllChannels } from '@features/channels/store/channels';
import { resetDmPresenceSubscription } from '@features/dmPresence/dmPresence';
import { clearIncomingState } from '@features/e2ee/incoming';
import { endAllSessions } from '@features/e2ee/session';
import { resetFriendsSubscription } from '@features/friends/friends';
import { clearMonitorList } from '@features/monitor/store/monitor';
import { getCurrentChannelName, getCurrentNick, getIsWizardCompleted, getServer, isSameName, setConnectedTime, setCurrentChannelName, setIsConnected, setIsConnecting, setLagMs, setWizardProgress } from '@features/settings/store/settings';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// Transport errors (TLS failure, refused): 'close' that follows only says "Disconnected"
export const handleError = (eventLine: string): void => {
  const message = eventLine || i18next.t('kernel.connectionError', { defaultValue: 'Connection error' });
  setAddMessage({
    id: uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: new Date().toISOString(),
    category: MessageCategory.error,
  });
};

export const handleConnect = (): void => {
  clearChannelWhoRequests();
  clearLabels();
  if (import.meta.env.DEV) {
    setAddChannel(DEBUG_CHANNEL, ChannelCategory.debug);
  }
  setAddChannel(STATUS_CHANNEL, ChannelCategory.status);
  // Show Status on connect, but never steal the view from a window the user is reading (reconnects, restored windows)
  const current = getCurrentChannelName();
  const viewingRealWindow = existChannel(current) && !isSameName(current, STATUS_CHANNEL);
  if (!viewingRealWindow) {
    setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
  }

  // Registration starts only here for both transports; a second CAP negotiation caused "Registration Timeout"
  const nick = getCurrentNick();
  const serverPassword = getServer()?.serverPassword;

  ircSendRawMessage('CAP LS 302');
  if (serverPassword) {
    ircSendRawMessage(`PASS ${serverPassword}`);
  }
  ircSendRawMessage(`NICK ${nick}`);
  ircSendRawMessage(`USER ${nick} 0 * :${nick}`);
};

export const handleConnected = (): void => {
  setIsConnecting(false);
  setIsConnected(true);
  setConnectedTime(Math.floor(Date.now() / 1000));

  // Friends re-subscribe once, at end of MOTD
  resetFriendsSubscription();
  resetDmPresenceSubscription();

  startKeepalive();

  resetInactivityReconnectRetries();
  clearSavedCredentials();

  clearPendingSTSUpgrade();
  resetSTSRetries();

  // NickServ fallback when SASL wasn't used or failed
  const nickServCredentials = getNickServFallbackCredentials();
  if (nickServCredentials) {
    ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${nickServCredentials.account} ${nickServCredentials.password}`);
    clearSaslCredentials();
  }

  setAddMessageToAllChannels({
    id: uuidv4(),
    message: i18next.t('kernel.connected'),
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });

  // The wizard handles channel selection itself
  if (getIsWizardCompleted()) {
    const channels = getChannelsToAutoJoin();
    if (channels.length > 0) {
      ircJoinChannels(channels);
    }
  }
};

export const handleDisconnected = (): void => {
  stopKeepalive();

  const stsUpgrade = getPendingSTSUpgrade();
  if (stsUpgrade) {
    handleSocketClose();
    return;
  }

  // A failed reconnect attempt: network.ts schedules the next retry
  if (getIsReconnecting()) {
    handleReconnectFailure();
    return;
  }

  setIsConnecting(false);
  setIsConnected(false);
  setLagMs(undefined);
  clearAllTyping();

  // Session keys are per-connection; the peer forgets them too
  endAllSessions();
  clearIncomingState();

  // MONITOR/WATCH dies with the socket, so stale presence can't be vouched for
  clearMonitorList();

  resetSTSRetries();

  setAddMessageToAllChannels({
    id: uuidv4(),
    message: i18next.t('kernel.disconnected'),
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

/** IRC socket close (not the WebSocket); drives the STS upgrade reconnect. */
export const handleSocketClose = (): void => {
  const stsUpgrade = getPendingSTSUpgrade();
  if (stsUpgrade) {
    if (hasExhaustedSTSRetries()) {
      clearPendingSTSUpgrade();
      resetSTSRetries();
      setIsConnecting(false);
      setAddMessageToAllChannels({
        id: uuidv4(),
        message: i18next.t('kernel.stsUpgradeFailed'),
        time: new Date().toISOString(),
        category: MessageCategory.error,
        color: MessageColor.error,
      });
      return;
    }

    incrementSTSRetries();
    // Kept pending so handleDisconnected doesn't show "Disconnected"; cleared on the TLS 001

    const server = getServer();
    const nick = getCurrentNick();

    if (server && nick) {
      setIsConnecting(true);
      setTimeout(async () => {
        await restoreSaslCredentials();
        ircConnectWithTLS(server, nick, stsUpgrade.port);
      }, 1000);
    }
  }
};

// ERROR :Closing Link: [1.1.1.1] (Registration Timeout)
// ERROR :Closing Link: [unknown@185.251.84.36] (SSL_do_accept failed)
export const onError = (ctx: IrcContext): void => {
  const message = ctx.trailing();

  // The server sends ERROR when we disconnect for the STS upgrade
  if (getPendingSTSUpgrade()) {
    return;
  }

  setAddMessageToAllChannels({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    time: new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });

  if (!getIsWizardCompleted()) {
    setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
  }
};

export const handlers: IrcHandlers = {
  ERROR: onError,
};
