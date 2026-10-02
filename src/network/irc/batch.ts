// https://ircv3.net/specs/extensions/batch.html

import { type LabeledRequest } from '@/network/irc/labels';
import { type ParsedIrcRawMessage } from '@shared/types';

export interface BatchState {
  id: string;
  /** chathistory, labeled-response, netjoin, netsplit, ... */
  type: string;
  params: string[];
  messages: ParsedIrcRawMessage[];
  startTime: number;
  /** For labeled-response: the command this batch answers */
  request?: LabeledRequest;
}

export const BATCH_TYPES = {
  CHATHISTORY: 'chathistory',
  LABELED_RESPONSE: 'labeled-response',
  NETJOIN: 'netjoin',
  NETSPLIT: 'netsplit',
} as const;

const MAX_BATCH_MESSAGES = 10_000;
const MAX_ACTIVE_BATCHES = 100;
const BATCH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const activeBatches = new Map<string, BatchState>();

export const startBatch = (id: string, type: string, params: string[], request?: LabeledRequest): void => {
  const now = Date.now();
  for (const [batchId, batch] of activeBatches) {
    if (now - batch.startTime > BATCH_TIMEOUT_MS) {
      activeBatches.delete(batchId);
    }
  }

  if (activeBatches.size >= MAX_ACTIVE_BATCHES) { return; }

  activeBatches.set(id, {
    id,
    type,
    params,
    messages: [],
    startTime: now,
    request,
  });
};

export const endBatch = (id: string): BatchState | undefined => {
  const batch = activeBatches.get(id);
  activeBatches.delete(id);
  return batch;
};

export const addToBatch = (batchId: string, message: ParsedIrcRawMessage): boolean => {
  const batch = activeBatches.get(batchId);
  if (!batch) {
    return false;
  }
  if (batch.messages.length >= MAX_BATCH_MESSAGES) {
    return false;
  }
  batch.messages.push(message);
  return true;
};

export const getBatch = (id: string): BatchState | undefined => {
  return activeBatches.get(id);
};

export const getMessageBatchId = (message: ParsedIrcRawMessage): string | undefined => {
  const batchId = message.tags.batch;
  if (batchId && activeBatches.has(batchId)) {
    return batchId;
  }
  return undefined;
};

export const clearAllBatches = (): void => {
  activeBatches.clear();
};
