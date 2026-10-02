// https://ircv3.net/specs/extensions/labeled-response

/** What the client needs to know when the replies to a labeled command arrive. */
export interface LabeledRequest {
  /** Window the command was sent from; its replies are shown there even if the user switched windows */
  window?: string;
  /** Sent by the client itself; its replies update state without being shown */
  automatic?: boolean;
}

// Replies normally arrive within seconds; this only bounds a server that never answers
const LABEL_TTL_MS = 60_000;
const MAX_PENDING_LABELS = 256;

const pending = new Map<string, { request: LabeledRequest; sentAt: number }>();
let labelCounter = 0;

export const createLabel = (request: LabeledRequest, now = Date.now()): string => {
  // Insertion order is chronological, so pruning stops at the first live entry
  for (const [label, entry] of pending) {
    if (now - entry.sentAt < LABEL_TTL_MS && pending.size < MAX_PENDING_LABELS) {
      break;
    }
    pending.delete(label);
  }

  labelCounter += 1;
  const label = `L${labelCounter}`;
  pending.set(label, { request, sentAt: now });
  return label;
};

/** The request a reply answers; a label is answered once (single reply, batch or ACK). */
export const takeLabel = (label: string): LabeledRequest | undefined => {
  const entry = pending.get(label);
  pending.delete(label);
  return entry?.request;
};

export const clearLabels = (): void => {
  pending.clear();
};
