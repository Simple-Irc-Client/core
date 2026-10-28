import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '../capabilities';
import * as networkFile from '../network';
import { announcePresence, sendPreAway, startPresenceWatch, stopPresenceWatch } from '../preAway';
import * as networksStore from '@features/networks/store/networks';

describe('preAway', () => {
  let send: ReturnType<typeof vi.spyOn>;
  let visibility: DocumentVisibilityState;
  let connected: boolean;
  let userFlags: string[];

  beforeEach(() => {
    visibility = 'visible';
    connected = false;
    userFlags = [];
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.spyOn(networksStore, 'getIsConnected').mockImplementation(() => connected);
    vi.spyOn(networksStore, 'getCurrentUserFlags').mockImplementation(() => userFlags);
    send = vi.spyOn(networkFile, 'ircSendCommand').mockImplementation(() => true);

    // Starts every test from a connection registered in view
    resetCapabilityState();
    sendPreAway();
    markCapabilitiesAcknowledged(['draft/pre-away']);
  });

  afterEach(() => {
    stopPresenceWatch();
    vi.restoreAllMocks();
  });

  const registerInBackground = (): void => {
    visibility = 'hidden';
    sendPreAway();
    connected = true;
  };

  describe('sendPreAway', () => {
    it('registers a connection opened in the background as not present', () => {
      visibility = 'hidden';

      sendPreAway();

      expect(send).toHaveBeenCalledExactlyOnceWith('AWAY *', { automatic: true });
    });

    it('leaves a connection opened in view as it is', () => {
      sendPreAway();

      expect(send).not.toHaveBeenCalled();
    });

    it('leaves it to a server without pre-away', () => {
      resetCapabilityState();
      visibility = 'hidden';

      sendPreAway();

      expect(send).not.toHaveBeenCalled();
    });

    it('does nothing for a capability acknowledged after registration', () => {
      connected = true;
      visibility = 'hidden';

      sendPreAway();

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('announcePresence', () => {
    it('marks the user present once they look', () => {
      registerInBackground();
      send.mockClear();
      visibility = 'visible';

      announcePresence();
      announcePresence();

      expect(send).toHaveBeenCalledExactlyOnceWith('AWAY', { automatic: true });
    });

    it('waits while the page is still hidden', () => {
      registerInBackground();
      send.mockClear();

      announcePresence();

      expect(send).not.toHaveBeenCalled();
    });

    it('waits for registration to finish', () => {
      registerInBackground();
      send.mockClear();
      connected = false;
      visibility = 'visible';

      announcePresence();
      expect(send).not.toHaveBeenCalled();

      connected = true;
      announcePresence();
      expect(send).toHaveBeenCalledExactlyOnceWith('AWAY', { automatic: true });
    });

    it('keeps an away set in the meantime', () => {
      registerInBackground();
      send.mockClear();
      userFlags = ['away'];
      visibility = 'visible';

      announcePresence();
      userFlags = [];
      announcePresence();

      expect(send).not.toHaveBeenCalled();
    });

    it('says nothing for a connection registered in view', () => {
      connected = true;

      announcePresence();

      expect(send).not.toHaveBeenCalled();
    });

    it('follows the page becoming visible', () => {
      startPresenceWatch();
      registerInBackground();
      send.mockClear();

      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));

      expect(send).toHaveBeenCalledExactlyOnceWith('AWAY', { automatic: true });
    });
  });
});
