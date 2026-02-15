/**
 * IRCv3 Batch Processing
 * https://ircv3.net/specs/extensions/batch.html
 */

import { type ParsedIrcRawMessage } from '@shared/types';

/** Represents an active batch being assembled */
export interface BatchState {
  /** Unique batch identifier */
  id: string;
  /** Batch type (chathistory, labeled-response, netjoin, netsplit, etc.) */
  type: string;
  /** Additional parameters for the batch */
  params: string[];
  /** Messages collected for this batch */
  messages: ParsedIrcRawMessage[];
  /** When the batch was started */
  startTime: number;
  /** Reference tag (for labeled-response) */
  referenceTag?: string;
}

/** Known batch types */
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

// Active batches being assembled
const activeBatches = new Map<string, BatchState>();

// Callbacks for batch completion
type BatchCallback = (batch: BatchState) => void;
const batchCallbacks = new Map<string, BatchCallback>();

/**
 * Start a new batch
 * @param id - Batch identifier (from BATCH +id)
 * @param type - Batch type
 * @param params - Additional parameters
 * @param referenceTag - Optional reference tag (for labeled-response)
 */
export const startBatch = (id: string, type: string, params: string[], referenceTag?: string): void => {
  // Evict stale batches
  const now = Date.now();
  for (const [batchId, batch] of activeBatches) {
    if (now - batch.startTime > BATCH_TIMEOUT_MS) {
      activeBatches.delete(batchId);
    }
  }

  if (activeBatches.size >= MAX_ACTIVE_BATCHES) return;

  activeBatches.set(id, {
    id,
    type,
    params,
    messages: [],
    startTime: now,
    referenceTag,
  });
};

/**
 * End a batch and return its contents
 * @param id - Batch identifier (from BATCH -id)
 * @returns The completed batch, or undefined if not found
 */
export const endBatch = (id: string): BatchState | undefined => {
  const batch = activeBatches.get(id);
  if (batch) {
    activeBatches.delete(id);

    // Call any registered callback
    const callback = batchCallbacks.get(id);
    if (callback) {
      callback(batch);
      batchCallbacks.delete(id);
    }
  }
  return batch;
};

/**
 * Add a message to an active batch
 * @param batchId - Batch identifier
 * @param message - Parsed IRC message
 * @returns true if message was added to batch, false if batch doesn't exist
 */
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

/**
 * Check if a batch is currently active
 * @param id - Batch identifier
 */
export const isBatchActive = (id: string): boolean => {
  return activeBatches.has(id);
};

/**
 * Get an active batch by ID
 * @param id - Batch identifier
 */
export const getBatch = (id: string): BatchState | undefined => {
  return activeBatches.get(id);
};

/**
 * Check if a message belongs to an active batch
 * @param message - Parsed IRC message
 * @returns The batch ID if message belongs to a batch, undefined otherwise
 */
export const getMessageBatchId = (message: ParsedIrcRawMessage): string | undefined => {
  const batchId = message.tags?.batch;
  if (batchId && activeBatches.has(batchId)) {
    return batchId;
  }
  return undefined;
};

/**
 * Register a callback for when a batch completes
 * @param id - Batch identifier
 * @param callback - Function to call when batch ends
 */
export const onBatchComplete = (id: string, callback: BatchCallback): void => {
  batchCallbacks.set(id, callback);
};

/**
 * Clear all active batches (on disconnect)
 */
export const clearAllBatches = (): void => {
  activeBatches.clear();
  batchCallbacks.clear();
};

/**
 * Get all active batch IDs
 */
export const getActiveBatchIds = (): string[] => {
  return Array.from(activeBatches.keys());
};

// Labeled response tracking
let labelCounter = 0;

interface PendingLabel {
  resolve: (batch: BatchState) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingLabels = new Map<string, PendingLabel>();

/**
 * Generate a unique label for labeled-response
 */
export const generateLabel = (): string => {
  return `L${++labelCounter}`;
};

/**
 * Register a pending labeled response
 * @param label - The label to track
 * @param timeoutMs - Timeout in milliseconds (default 30s)
 * @returns Promise that resolves when labeled-response batch completes
 */
export const registerLabeledResponse = (label: string, timeoutMs = 30000): Promise<BatchState> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingLabels.delete(label);
      reject(new Error(`Labeled response timeout for ${label}`));
    }, timeoutMs);

    pendingLabels.set(label, { resolve, reject, timeout });
  });
};

/**
 * Resolve a pending labeled response
 * @param label - The label that was completed
 * @param batch - The batch containing the response
 */
export const resolveLabeledResponse = (label: string, batch: BatchState): void => {
  const pending = pendingLabels.get(label);
  if (pending) {
    clearTimeout(pending.timeout);
    pending.resolve(batch);
    pendingLabels.delete(label);
  }
};

/**
 * Clear all pending labeled responses (on disconnect)
 */
export const clearPendingLabels = (): void => {
  for (const [, pending] of pendingLabels) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Disconnected'));
  }
  pendingLabels.clear();
  labelCounter = 0;
};
