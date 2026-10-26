import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearBouncerBind, connectToBouncerNetwork, isBouncerControlConnection, onBouncerFailed, sendBouncerBind } from '../bouncer';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '../capabilities';
import * as networkFile from '../network';
import * as saslFile from '../sasl';
import { type Server } from '../servers';
import { clearBouncerNetworks, setBoundBouncerNetworkId } from '@features/bouncer/store/bouncerNetworks';
import { getActiveNetworkId, getCurrentNick, getServer, setIsConnected } from '@features/networks/store/networks';
import { connectTestNetwork, resetNetworks } from '@/test/networks';

const bouncerServer = (networkId?: string): Server => ({
  default: 0,
  encoding: 'utf8',
  network: 'bouncer.example.net',
  servers: ['bouncer.example.net'],
  bouncer: { account: 'alice', encryptedPassword: 'encrypted', networkId },
});

describe('bouncer', () => {
  let send: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearBouncerBind();
    clearBouncerNetworks();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['sasl', 'soju.im/bouncer-networks']);
    resetNetworks();
    connectTestNetwork(bouncerServer('1'), 'alice');
    send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    vi.spyOn(saslFile, 'getSaslState').mockImplementation(() => 'success');
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
      ['no network was chosen yet', () => { connectTestNetwork(bouncerServer(), 'alice'); }],
      ['the server is no bouncer', () => { connectTestNetwork({ ...bouncerServer(), bouncer: undefined }, 'alice'); }],
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

      expect(getServer()?.bouncer).toEqual({ account: 'alice', encryptedPassword: 'encrypted', networkId: undefined });
      expect(getActiveNetworkId()).toBe('bouncer.example.net');
      expect(disconnect).toHaveBeenCalled();
      expect(reconnect).toHaveBeenCalledWith({ announce: false });
    });

    it('keeps the network and the connection for a failure that did not answer a BIND', () => {
      const reconnect = vi.spyOn(networkFile, 'ircReconnect').mockImplementation(() => Promise.resolve(true));
      onBouncerFailed();
      sendBouncerBind();
      setIsConnected(true);
      onBouncerFailed();

      expect(getServer()?.bouncer?.networkId).toBe('1');
      expect(reconnect).not.toHaveBeenCalled();
    });
  });

  describe('connectToBouncerNetwork', () => {
    it('connects again, as the same nick, to the network chosen as a network of its own', () => {
      connectTestNetwork(bouncerServer(), 'alice');
      setIsConnected(true);
      const disconnect = vi.spyOn(networkFile, 'ircDisconnect').mockImplementation(() => {});
      const reconnect = vi.spyOn(networkFile, 'ircReconnect').mockImplementation(() => Promise.resolve(true));

      connectToBouncerNetwork('5');

      expect(getActiveNetworkId()).toBe('bouncer.example.net/bouncer:5');
      expect(getServer()?.bouncer?.networkId).toBe('5');
      expect(getCurrentNick()).toBe('alice');
      expect(reconnect).toHaveBeenCalledWith({ announce: false });
      expect(disconnect.mock.invocationCallOrder[0]).toBeLessThan(reconnect.mock.invocationCallOrder[0] ?? 0);
    });

    it('does nothing for a server without a bouncer account', () => {
      connectTestNetwork({ ...bouncerServer(), bouncer: undefined }, 'alice');
      const reconnect = vi.spyOn(networkFile, 'ircReconnect').mockImplementation(() => Promise.resolve(true));

      connectToBouncerNetwork('5');

      expect(reconnect).not.toHaveBeenCalled();
    });
  });
});
