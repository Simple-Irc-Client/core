import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearBouncerBind, connectToBouncerNetwork, isBouncerControlConnection, onBouncerFailed, sendBouncerBind } from '../bouncer';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '../capabilities';
import * as networkFile from '../network';
import * as saslFile from '../sasl';
import { type Server } from '../servers';
import { clearBouncerNetworks, setBoundBouncerNetworkId } from '@features/bouncer/store/bouncerNetworks';
import * as settingsFile from '@features/settings/store/settings';

const bouncerServer = (networkId?: string): Server => ({
  default: 0,
  encoding: 'utf8',
  network: 'bouncer.example.net',
  servers: ['bouncer.example.net'],
  bouncer: { account: 'alice', encryptedPassword: 'encrypted', networkId },
});

describe('bouncer', () => {
  let send: ReturnType<typeof vi.spyOn>;
  let server: Server | undefined;
  let connected: boolean;

  beforeEach(() => {
    clearBouncerBind();
    clearBouncerNetworks();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['sasl', 'soju.im/bouncer-networks']);
    server = bouncerServer('1');
    connected = false;
    send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    vi.spyOn(saslFile, 'getSaslState').mockImplementation(() => 'success');
    vi.spyOn(settingsFile, 'getServer').mockImplementation(() => server);
    vi.spyOn(settingsFile, 'setServer').mockImplementation((newServer) => { server = newServer; });
    vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => connected);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendBouncerBind', () => {
    it('binds the connection to the network chosen', () => {
      sendBouncerBind();

      expect(send).toHaveBeenCalledExactlyOnceWith('BOUNCER BIND 1');
    });

    it('binds once per connection, though capabilities added later end negotiation again', () => {
      sendBouncerBind();
      sendBouncerBind();
      clearBouncerBind();
      sendBouncerBind();

      expect(send).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['no network was chosen yet', () => { server = bouncerServer(); }],
      ['the server is no bouncer', () => { server = { ...bouncerServer(), bouncer: undefined }; }],
      ['the server lacks bouncer-networks', () => { resetCapabilityState(); }],
      ['the account did not log in', () => { vi.spyOn(saslFile, 'getSaslState').mockImplementation(() => 'failed'); }],
    ])('does not bind when %s', (_case, arrange) => {
      arrange();

      sendBouncerBind();

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('isBouncerControlConnection', () => {
    it('is the bouncer\'s own connection until it reports a bound network', () => {
      expect(isBouncerControlConnection()).toBe(true);

      setBoundBouncerNetworkId('1');

      expect(isBouncerControlConnection()).toBe(false);
    });

    it('is not one on a server without bouncer-networks', () => {
      resetCapabilityState();

      expect(isBouncerControlConnection()).toBe(false);
    });
  });

  describe('onBouncerFailed', () => {
    it('forgets a network the bouncer refused to bind, and connects again to choose another', () => {
      const disconnect = vi.spyOn(networkFile, 'ircDisconnect').mockImplementation(() => {});
      const reconnect = vi.spyOn(networkFile, 'ircReconnect').mockImplementation(() => Promise.resolve(true));
      sendBouncerBind();

      onBouncerFailed();

      expect(server?.bouncer).toEqual({ account: 'alice', encryptedPassword: 'encrypted', networkId: undefined });
      expect(disconnect).toHaveBeenCalled();
      expect(reconnect).toHaveBeenCalledWith({ announce: false });
    });

    it('keeps the network and the connection for a failure that did not answer a BIND', () => {
      const reconnect = vi.spyOn(networkFile, 'ircReconnect').mockImplementation(() => Promise.resolve(true));
      onBouncerFailed();
      sendBouncerBind();
      connected = true;
      onBouncerFailed();

      expect(server?.bouncer?.networkId).toBe('1');
      expect(reconnect).not.toHaveBeenCalled();
    });
  });

  describe('connectToBouncerNetwork', () => {
    it('connects again, bound to the network chosen, with nothing of the network before', () => {
      server = bouncerServer();
      connected = true;
      const disconnect = vi.spyOn(networkFile, 'ircDisconnect').mockImplementation(() => {});
      const reconnect = vi.spyOn(networkFile, 'ircReconnect').mockImplementation(() => Promise.resolve(true));
      const clearForAnotherNetwork = vi.spyOn(settingsFile, 'clearForAnotherNetwork').mockImplementation(() => {});
      const setServer = vi.mocked(settingsFile.setServer);

      connectToBouncerNetwork('5');

      expect(server?.bouncer?.networkId).toBe('5');
      expect(reconnect).toHaveBeenCalledWith({ announce: false });
      const order = [disconnect, clearForAnotherNetwork, setServer, reconnect].map((spy) => spy.mock.invocationCallOrder[0] ?? 0);
      // Cleared while still stored under the old network, which the bouncer brings back on return
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('does nothing for a server without a bouncer account', () => {
      server = { ...bouncerServer(), bouncer: undefined };
      const reconnect = vi.spyOn(networkFile, 'ircReconnect').mockImplementation(() => Promise.resolve(true));

      connectToBouncerNetwork('5');

      expect(reconnect).not.toHaveBeenCalled();
    });
  });
});
