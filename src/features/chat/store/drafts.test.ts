import { describe, it, expect, beforeEach } from 'vitest';
import { useDraftsStore, setDraft, getDraft, clearDraft, clearAllDrafts } from './drafts';

describe('drafts store', () => {
  beforeEach(() => {
    // Reset store before each test
    clearAllDrafts();
  });

  describe('setDraft', () => {
    it('should save a draft for a channel', () => {
      setDraft('#general', 'Hello world');

      expect(getDraft('#general')).toBe('Hello world');
    });

    it('should save drafts for multiple channels', () => {
      setDraft('#general', 'Hello general');
      setDraft('#random', 'Hello random');
      setDraft('privateUser', 'Hello private');

      expect(getDraft('#general')).toBe('Hello general');
      expect(getDraft('#random')).toBe('Hello random');
      expect(getDraft('privateUser')).toBe('Hello private');
    });

    it('should overwrite existing draft for a channel', () => {
      setDraft('#general', 'First message');
      setDraft('#general', 'Updated message');

      expect(getDraft('#general')).toBe('Updated message');
    });

    it('should clear draft when setting empty string', () => {
      setDraft('#general', 'Hello world');
      setDraft('#general', '');

      expect(getDraft('#general')).toBe('');
      expect(useDraftsStore.getState().drafts['#general']).toBeUndefined();
    });
  });

  describe('getDraft', () => {
    it('should return empty string for channel with no draft', () => {
      expect(getDraft('#nonexistent')).toBe('');
    });

    it('should return saved draft for channel', () => {
      setDraft('#general', 'Test message');

      expect(getDraft('#general')).toBe('Test message');
    });
  });

  describe('clearDraft', () => {
    it('should remove draft for specific channel', () => {
      setDraft('#general', 'Hello general');
      setDraft('#random', 'Hello random');

      clearDraft('#general');

      expect(getDraft('#general')).toBe('');
      expect(getDraft('#random')).toBe('Hello random');
    });

    it('should not throw when clearing non-existent draft', () => {
      expect(() => clearDraft('#nonexistent')).not.toThrow();
    });
  });

  describe('clearAllDrafts', () => {
    it('should remove all drafts', () => {
      setDraft('#general', 'Hello general');
      setDraft('#random', 'Hello random');
      setDraft('privateUser', 'Hello private');

      clearAllDrafts();

      expect(getDraft('#general')).toBe('');
      expect(getDraft('#random')).toBe('');
      expect(getDraft('privateUser')).toBe('');
      expect(useDraftsStore.getState().drafts).toEqual({});
    });
  });

  describe('useDraftsStore direct access', () => {
    it('should allow direct store manipulation', () => {
      useDraftsStore.getState().setDraft('#test', 'Direct set');

      expect(useDraftsStore.getState().getDraft('#test')).toBe('Direct set');
    });

    it('should track drafts in store state', () => {
      setDraft('#channel1', 'Draft 1');
      setDraft('#channel2', 'Draft 2');

      const { drafts } = useDraftsStore.getState();

      expect(drafts).toEqual({
        '#channel1': 'Draft 1',
        '#channel2': 'Draft 2',
      });
    });
  });
});
