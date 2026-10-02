import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startBatch,
  endBatch,
  addToBatch,
  isBatchActive,
  getBatch,
  getMessageBatchId,
  onBatchComplete,
  clearAllBatches,
  getActiveBatchIds,
  BATCH_TYPES,
} from '../batch';
import { type ParsedIrcRawMessage } from '@shared/types';

describe('batch', () => {
  beforeEach(() => {
    clearAllBatches();
  });

  describe('startBatch', () => {
    it('should start a new batch', () => {
      startBatch('batch1', 'chathistory', ['#channel']);

      expect(isBatchActive('batch1')).toBe(true);
      const batch = getBatch('batch1');
      expect(batch).toBeDefined();
      expect(batch?.type).toBe('chathistory');
      expect(batch?.params).toEqual(['#channel']);
      expect(batch?.messages).toEqual([]);
    });

    it('should store the labeled request it answers', () => {
      startBatch('batch2', 'labeled-response', [], { window: '#chan' });

      const batch = getBatch('batch2');
      expect(batch?.request).toEqual({ window: '#chan' });
    });
  });

  describe('endBatch', () => {
    it('should end batch and return contents', () => {
      startBatch('batch1', 'chathistory', ['#test']);

      const message: ParsedIrcRawMessage = {
        tags: { msgid: '123' },
        sender: ':nick!user@host',
        command: 'PRIVMSG',
        line: ['#test', ':hello'],
      };
      addToBatch('batch1', message);

      const batch = endBatch('batch1');

      expect(batch).toBeDefined();
      expect(batch?.messages).toHaveLength(1);
      expect(isBatchActive('batch1')).toBe(false);
    });

    it('should return undefined for non-existent batch', () => {
      const batch = endBatch('nonexistent');
      expect(batch).toBeUndefined();
    });

    it('should call registered callback', () => {
      const callback = vi.fn();
      startBatch('batch1', 'chathistory', []);
      onBatchComplete('batch1', callback);

      endBatch('batch1');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'batch1' }));
    });
  });

  describe('addToBatch', () => {
    it('should add message to active batch', () => {
      startBatch('batch1', 'chathistory', []);

      const message: ParsedIrcRawMessage = {
        tags: {},
        sender: ':nick!user@host',
        command: 'PRIVMSG',
        line: ['#test', ':message'],
      };

      const result = addToBatch('batch1', message);

      expect(result).toBe(true);
      expect(getBatch('batch1')?.messages).toHaveLength(1);
    });

    it('should return false for non-existent batch', () => {
      const message: ParsedIrcRawMessage = {
        tags: {},
        sender: '',
        command: 'PRIVMSG',
        line: [],
      };

      const result = addToBatch('nonexistent', message);
      expect(result).toBe(false);
    });
  });

  describe('getMessageBatchId', () => {
    it('should return batch id if message belongs to active batch', () => {
      startBatch('batch1', 'chathistory', []);

      const message: ParsedIrcRawMessage = {
        tags: { batch: 'batch1' },
        sender: '',
        command: 'PRIVMSG',
        line: [],
      };

      expect(getMessageBatchId(message)).toBe('batch1');
    });

    it('should return undefined if batch is not active', () => {
      const message: ParsedIrcRawMessage = {
        tags: { batch: 'nonexistent' },
        sender: '',
        command: 'PRIVMSG',
        line: [],
      };

      expect(getMessageBatchId(message)).toBeUndefined();
    });

    it('should return undefined if message has no batch tag', () => {
      const message: ParsedIrcRawMessage = {
        tags: {},
        sender: '',
        command: 'PRIVMSG',
        line: [],
      };

      expect(getMessageBatchId(message)).toBeUndefined();
    });
  });

  describe('getActiveBatchIds', () => {
    it('should return all active batch ids', () => {
      startBatch('batch1', 'chathistory', []);
      startBatch('batch2', 'netsplit', []);

      const ids = getActiveBatchIds();

      expect(ids).toContain('batch1');
      expect(ids).toContain('batch2');
      expect(ids).toHaveLength(2);
    });

    it('should return empty array when no batches', () => {
      expect(getActiveBatchIds()).toEqual([]);
    });
  });

  describe('clearAllBatches', () => {
    it('should clear all active batches', () => {
      startBatch('batch1', 'chathistory', []);
      startBatch('batch2', 'netsplit', []);

      clearAllBatches();

      expect(getActiveBatchIds()).toEqual([]);
      expect(isBatchActive('batch1')).toBe(false);
      expect(isBatchActive('batch2')).toBe(false);
    });
  });

  describe('limits', () => {
    it('should cap messages per batch at 10000', () => {
      startBatch('big', 'chathistory', []);

      const message: ParsedIrcRawMessage = {
        tags: {},
        sender: ':nick!user@host',
        command: 'PRIVMSG',
        line: ['#test', ':msg'],
      };

      for (let i = 0; i < 10_050; i++) {
        addToBatch('big', message);
      }

      expect(getBatch('big')?.messages.length).toBe(10_000);
    });

    it('should return false when batch message limit reached', () => {
      startBatch('big', 'chathistory', []);

      const message: ParsedIrcRawMessage = {
        tags: {},
        sender: ':nick!user@host',
        command: 'PRIVMSG',
        line: ['#test', ':msg'],
      };

      for (let i = 0; i < 10_000; i++) {
        addToBatch('big', message);
      }

      const result = addToBatch('big', message);
      expect(result).toBe(false);
    });

    it('should cap active batches at 100', () => {
      for (let i = 0; i < 110; i++) {
        startBatch(`batch${i}`, 'chathistory', []);
      }

      expect(getActiveBatchIds().length).toBe(100);
    });
  });

  describe('BATCH_TYPES', () => {
    it('should have correct batch type constants', () => {
      expect(BATCH_TYPES.CHATHISTORY).toBe('chathistory');
      expect(BATCH_TYPES.LABELED_RESPONSE).toBe('labeled-response');
      expect(BATCH_TYPES.NETJOIN).toBe('netjoin');
      expect(BATCH_TYPES.NETSPLIT).toBe('netsplit');
      expect(BATCH_TYPES.MULTILINE).toBe('draft/multiline');
    });
  });
});
