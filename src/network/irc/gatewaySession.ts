/**
 * Resumable gateway sessions: the gateway keeps the IRC connection while the WebSocket is gone (e.g. a phone with
 * the tab in the background), and replays what this page missed when it reconnects.
 */

export const GATEWAY_SEQ_TAG = 'simpleircclient.com/seq';

// Outlives a reload of this tab, so the next page can end the session it can no longer resume
const STORAGE_KEY = 'sic-gateway-session';

export type GatewayHello = 'session' | 'resume';

let token: string | null = null;
let lastSeenSeq = 0;
let expectedHello: GatewayHello | null = null;

const readStoredToken = (): string | null => {
  try {
    return globalThis.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeToken = (value: string | null): void => {
  try {
    if (value === null) {
      globalThis.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      globalThis.sessionStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Without storage a reloaded page only can't end the old session; the gateway expires it
  }
};

/** Whether this page holds a session the gateway may still keep. */
export const hasGatewaySession = (): boolean => token !== null;

/** Query parameters for the next gateway WebSocket: resumes this page's session if asked to, otherwise starts a new one. */
export const beginGatewayConnection = (resume: boolean): Record<string, string> => {
  if (resume && token !== null) {
    expectedHello = 'resume';
    return { resume: token, since: String(lastSeenSeq) };
  }

  const previous = token ?? readStoredToken();
  token = null;
  lastSeenSeq = 0;
  expectedHello = 'session';
  return previous === null ? { session: 'true' } : { session: 'true', replace: previous };
};

export const isAwaitingGatewayResume = (): boolean => expectedHello === 'resume';

/** What the first line of the connection should be; only that line may come from the gateway itself. */
export const takeExpectedGatewayHello = (): GatewayHello | null => {
  const expected = expectedHello;
  expectedHello = null;
  return expected;
};

export const rememberGatewaySession = (newToken: string): void => {
  token = newToken;
  lastSeenSeq = 0;
  storeToken(newToken);
};

export const noteGatewaySeq = (value: string | undefined): void => {
  const seq = Number(value);
  if (value !== undefined && Number.isSafeInteger(seq) && seq > lastSeenSeq) {
    lastSeenSeq = seq;
  }
};

export const forgetGatewaySession = (): void => {
  token = null;
  lastSeenSeq = 0;
  expectedHello = null;
  storeToken(null);
};
