// Leaving a network: what the connection taught goes, what belongs to the network stays with it

import { ircDisconnect } from '@/network/irc/network';
import { forgetChannelsToAutoJoin, setChannelsClearAll } from '@features/channels/store/channels';
import { setChannelListClear } from '@features/channels/store/channelList';
import { setCurrentClearAll } from '@features/chat/store/current';
import { clearMonitorList } from '@features/monitor/store/monitor';
import { clearAllReplies } from '@features/replies/store/replyTo';
import { resetWizardState, setWizardNick } from '@features/settings/store/settings';
import { setUsersClearAll } from '@features/users/store/users';
import { type Server } from '@/network/irc/servers';
import { activateNetwork, deactivateNetwork, getCurrentNick, resetConnectionSession } from './store/networks';

/** What the connection to the active network taught: its users, channel list and MONITOR, and the window showing them */
const clearConnectionData = (): void => {
  setUsersClearAll();
  setCurrentClearAll();
  setChannelListClear();
  clearMonitorList();
  clearAllReplies();
};

/** Back to the wizard on the same network; its channels are joined again on the next connection */
export const resetAndGoToStart = (clearNick = false): void => {
  ircDisconnect();

  setChannelsClearAll();
  clearConnectionData();
  resetConnectionSession();
  resetWizardState();

  if (clearNick) {
    setWizardNick('');
  }
};

/** Back to the wizard to choose another network; the one left keeps its windows */
export const changeServer = (): void => {
  ircDisconnect();

  clearConnectionData();
  resetConnectionSession();
  forgetChannelsToAutoJoin();
  deactivateNetwork();
  resetWizardState();
  setWizardNick('');
};

/** From one network on a bouncer to another, as the same nick; the wizard stays where it is */
export const switchToBouncerNetwork = (server: Server): void => {
  clearConnectionData();
  resetConnectionSession();
  forgetChannelsToAutoJoin();
  activateNetwork(server, getCurrentNick());
};
