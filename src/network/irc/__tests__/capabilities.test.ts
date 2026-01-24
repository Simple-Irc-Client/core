import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCapabilityState,
  resetCapabilityState,
  addAvailableCapabilities,
  markCapabilitiesRequested,
  markCapabilitiesAcknowledged,
  removeCapabilities,
  isCapabilityAvailable,
  isCapabilityEnabled,
  getCapabilityValue,
  getCapabilitiesToRequest,
  parseCapabilityList,
  parseSaslMechanisms,
  getCapabilityState,
  setAwaitingMoreCaps,
  startCapNegotiation,
  endCapNegotiation,
  DESIRED_CAPABILITIES,
} from '../capabilities';

describe('capabilities', () => {
  beforeEach(() => {
    resetCapabilityState();
  });

  describe('createCapabilityState', () => {
    it('should create initial state', () => {
      const state = createCapabilityState();
      expect(state.available.size).toBe(0);
      expect(state.requested.size).toBe(0);
      expect(state.acknowledged.size).toBe(0);
      expect(state.negotiating).toBe(false);
      expect(state.awaitingMoreCaps).toBe(false);
    });
  });

  describe('parseCapabilityList', () => {
    it('should parse simple capabilities', () => {
      const result = parseCapabilityList('cap1 cap2 cap3');
      expect(result).toEqual({ cap1: '', cap2: '', cap3: '' });
    });

    it('should parse capabilities with values', () => {
      const result = parseCapabilityList('sasl=PLAIN,EXTERNAL multi-prefix');
      expect(result).toEqual({ sasl: 'PLAIN,EXTERNAL', 'multi-prefix': '' });
    });

    it('should handle leading colon', () => {
      const result = parseCapabilityList(':cap1 cap2');
      expect(result).toEqual({ cap1: '', cap2: '' });
    });

    it('should parse complex capability string', () => {
      const result = parseCapabilityList('sts=port=6697,duration=300 away-notify message-tags');
      expect(result).toEqual({
        sts: 'port=6697,duration=300',
        'away-notify': '',
        'message-tags': '',
      });
    });

    it('should handle empty string', () => {
      const result = parseCapabilityList('');
      expect(result).toEqual({});
    });
  });

  describe('parseSaslMechanisms', () => {
    it('should parse comma-separated mechanisms', () => {
      const result = parseSaslMechanisms('PLAIN,EXTERNAL,SCRAM-SHA-256');
      expect(result).toEqual(['PLAIN', 'EXTERNAL', 'SCRAM-SHA-256']);
    });

    it('should return PLAIN as default when empty', () => {
      const result = parseSaslMechanisms('');
      expect(result).toEqual(['PLAIN']);
    });

    it('should handle single mechanism', () => {
      const result = parseSaslMechanisms('PLAIN');
      expect(result).toEqual(['PLAIN']);
    });
  });

  describe('addAvailableCapabilities', () => {
    it('should add capabilities to available set', () => {
      addAvailableCapabilities({ 'multi-prefix': '', sasl: 'PLAIN' });

      expect(isCapabilityAvailable('multi-prefix')).toBe(true);
      expect(isCapabilityAvailable('sasl')).toBe(true);
      expect(isCapabilityAvailable('unknown')).toBe(false);
    });

    it('should preserve capability values', () => {
      addAvailableCapabilities({ sasl: 'PLAIN,EXTERNAL' });

      expect(getCapabilityValue('sasl')).toBe('PLAIN,EXTERNAL');
    });
  });

  describe('markCapabilitiesRequested', () => {
    it('should mark capabilities as requested', () => {
      markCapabilitiesRequested(['cap1', 'cap2']);

      const state = getCapabilityState();
      expect(state.requested.has('cap1')).toBe(true);
      expect(state.requested.has('cap2')).toBe(true);
    });
  });

  describe('markCapabilitiesAcknowledged', () => {
    it('should mark capabilities as acknowledged', () => {
      markCapabilitiesAcknowledged(['cap1', 'cap2']);

      expect(isCapabilityEnabled('cap1')).toBe(true);
      expect(isCapabilityEnabled('cap2')).toBe(true);
      expect(isCapabilityEnabled('cap3')).toBe(false);
    });
  });

  describe('removeCapabilities', () => {
    it('should remove capabilities from available and acknowledged', () => {
      addAvailableCapabilities({ cap1: '', cap2: '' });
      markCapabilitiesAcknowledged(['cap1', 'cap2']);

      removeCapabilities(['cap1']);

      expect(isCapabilityAvailable('cap1')).toBe(false);
      expect(isCapabilityEnabled('cap1')).toBe(false);
      expect(isCapabilityAvailable('cap2')).toBe(true);
      expect(isCapabilityEnabled('cap2')).toBe(true);
    });
  });

  describe('getCapabilitiesToRequest', () => {
    it('should return desired capabilities that are available but not acknowledged', () => {
      // Add some capabilities that are in DESIRED_CAPABILITIES
      addAvailableCapabilities({
        'message-tags': '',
        'server-time': '',
        'away-notify': '',
        'unknown-cap': '', // not in desired list
      });

      const toRequest = getCapabilitiesToRequest();

      expect(toRequest).toContain('message-tags');
      expect(toRequest).toContain('server-time');
      expect(toRequest).toContain('away-notify');
      expect(toRequest).not.toContain('unknown-cap');
    });

    it('should not include already acknowledged capabilities', () => {
      addAvailableCapabilities({ 'message-tags': '', 'server-time': '' });
      markCapabilitiesAcknowledged(['message-tags']);

      const toRequest = getCapabilitiesToRequest();

      expect(toRequest).not.toContain('message-tags');
      expect(toRequest).toContain('server-time');
    });

    it('should return empty array when no desired caps are available', () => {
      addAvailableCapabilities({ 'unknown-cap': '' });

      const toRequest = getCapabilitiesToRequest();

      expect(toRequest).toEqual([]);
    });
  });

  describe('negotiation state', () => {
    it('should track negotiation state', () => {
      expect(getCapabilityState().negotiating).toBe(false);

      startCapNegotiation();
      expect(getCapabilityState().negotiating).toBe(true);

      endCapNegotiation();
      expect(getCapabilityState().negotiating).toBe(false);
    });

    it('should track awaiting more caps', () => {
      expect(getCapabilityState().awaitingMoreCaps).toBe(false);

      setAwaitingMoreCaps(true);
      expect(getCapabilityState().awaitingMoreCaps).toBe(true);

      setAwaitingMoreCaps(false);
      expect(getCapabilityState().awaitingMoreCaps).toBe(false);
    });
  });

  describe('resetCapabilityState', () => {
    it('should reset all state', () => {
      addAvailableCapabilities({ cap1: '' });
      markCapabilitiesRequested(['cap1']);
      markCapabilitiesAcknowledged(['cap1']);
      startCapNegotiation();
      setAwaitingMoreCaps(true);

      resetCapabilityState();

      const state = getCapabilityState();
      expect(state.available.size).toBe(0);
      expect(state.requested.size).toBe(0);
      expect(state.acknowledged.size).toBe(0);
      expect(state.negotiating).toBe(false);
      expect(state.awaitingMoreCaps).toBe(false);
    });
  });

  describe('DESIRED_CAPABILITIES', () => {
    it('should include core IRCv3 capabilities', () => {
      expect(DESIRED_CAPABILITIES).toContain('message-tags');
      expect(DESIRED_CAPABILITIES).toContain('server-time');
      expect(DESIRED_CAPABILITIES).toContain('batch');
      expect(DESIRED_CAPABILITIES).toContain('sasl');
      expect(DESIRED_CAPABILITIES).toContain('away-notify');
      expect(DESIRED_CAPABILITIES).toContain('account-notify');
      expect(DESIRED_CAPABILITIES).toContain('echo-message');
    });
  });
});
