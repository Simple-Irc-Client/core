// https://ircv3.net/specs/extensions/batch.html

import { type ParsedIrcRawMessage } from '@shared/types';

export interface BatchState {
  id: string;
  /** chathistory, labeled-response, netjoin, netsplit, ... */
  type: string;
  params: string[];
  messages: ParsedIrcRawMessage[];
  startTime: number;
  /** For labeled-response */
  referenceTag?: string;
}

export const BATCH_TYPES = {
  CHATHISTORY: 'chathistory',
  LABELED_RESPONSE: 'labeled-response',
  NETJOIN: 'netjoin',
  NETSPLIT: 'netsplit',
  MULTILINE: 'draft/multiline',
} as const;

const MAX_BATCH_MESSAGES = 10_000;
const MAX_ACTIVE_BATCHES = 100;
const BATCH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const activeBatches = new Map<string, BatchState>();

type BatchCallback = (batch: BatchState) => void;
const batchCallbacks = new Map<string, BatchCallback>();

export const startBatch = (id: string, type: string, params: string[], referenceTag?: string): void => {
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
    referenceTag,
  });
};

export const endBatch = (id: string): BatchState | undefined => {
  const batch = activeBatches.get(id);
  if (batch) {
    activeBatches.delete(id);

    const callback = batchCallbacks.get(id);
    if (callback) {
      callback(batch);
      batchCallbacks.delete(id);
    }
  }
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

export const isBatchActive = (id: string): boolean => {
  return activeBatches.has(id);
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

export const onBatchComplete = (id: string, callback: BatchCallback): void => {
  batchCallbacks.set(id, callback);
};

export const clearAllBatches = (): void => {
  activeBatches.clear();
  batchCallbacks.clear();
};

export const getActiveBatchIds = (): string[] => {
  return Array.from(activeBatches.keys());
};

let labelCounter = 0;

interface PendingLabel {
  resolve: (batch: BatchState) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingLabels = new Map<string, PendingLabel>();

export const generateLabel = (): string => {
  return `L${++labelCounter}`;
};

export const registerLabeledResponse = (label: string, timeoutMs = 30000): Promise<BatchState> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingLabels.delete(label);
      reject(new Error(`Labeled response timeout for ${label}`));
    }, timeoutMs);

    pendingLabels.set(label, { resolve, reject, timeout });
  });
};

export const resolveLabeledResponse = (label: string, batch: BatchState): void => {
  const pending = pendingLabels.get(label);
  if (pending) {
    clearTimeout(pending.timeout);
    pending.resolve(batch);
    pendingLabels.delete(label);
  }
};

export const clearPendingLabels = (): void => {
  for (const [, pending] of pendingLabels) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Disconnected'));
  }
  pendingLabels.clear();
  labelCounter = 0;
};
