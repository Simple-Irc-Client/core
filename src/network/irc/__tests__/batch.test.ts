import { describe, it, expect, beforeEach } from 'vitest';
import {
  startBatch,
  endBatch,
  addToBatch,
  getBatch,
  getMessageBatchId,
  clearAllBatches,
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
      expect(getBatch('batch1')).toBeUndefined();
    });

    it('should return undefined for non-existent batch', () => {
      const batch = endBatch('nonexistent');
      expect(batch).toBeUndefined();
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

  describe('clearAllBatches', () => {
    it('should clear all active batches', () => {
      startBatch('batch1', 'chathistory', []);
      startBatch('batch2', 'netsplit', []);

      clearAllBatches();

      expect(getBatch('batch1')).toBeUndefined();
      expect(getBatch('batch2')).toBeUndefined();
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

      const started = Array.from({ length: 110 }, (_, i) => getBatch(`batch${i}`)).filter((batch) => batch !== undefined);
      expect(started).toHaveLength(100);
    });
  });

  describe('BATCH_TYPES', () => {
    it('should have correct batch type constants', () => {
      expect(BATCH_TYPES.CHATHISTORY).toBe('chathistory');
      expect(BATCH_TYPES.LABELED_RESPONSE).toBe('labeled-response');
      expect(BATCH_TYPES.NETJOIN).toBe('netjoin');
      expect(BATCH_TYPES.NETSPLIT).toBe('netsplit');
    });
  });
});
