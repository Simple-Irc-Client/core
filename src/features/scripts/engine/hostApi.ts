import type { QuickJSContext, QuickJSHandle } from 'quickjs-emscripten-core';

/**
 * Host-side primitives injected into a script VM as `__host_*` globals.
 * The bootstrap source captures them into the `sic` API and deletes the
 * globals, so this is the complete capability surface of a script.
 *
 * Bindings are injected (rather than importing app stores directly) so the
 * engine stays testable without the app and ScriptManager owns the wiring.
 */
export interface HostBindings {
  say: (target: string, text: string) => void;
  sendRaw: (line: string) => void;
  print: (text: string, target?: string) => void;
  /** Returns the names rejected as collisions */
  registerCommand: (name: string, aliases: string[]) => string[];
  getNick: () => string;
  getCurrentChannel: () => string;
  fetchImpl?: typeof fetch;
}

export interface HostApiEnv {
  bindings: HostBindings;
  /** In-flight fetch controllers, aborted by ScriptRuntime.dispose() */
  abortControllers: Set<AbortController>;
  /** Unsettled VM promises — ScriptRuntime.dispose() must free them before the context */
  liveDeferreds: Set<{ alive: boolean; dispose: () => void }>;
  isContextAlive: () => boolean;
  /** Drains VM microtasks (promise callbacks) under a fresh interrupt deadline */
  runPendingJobs: () => void;
}

const FETCH_TIMEOUT_MS = 10_000;
const FETCH_MAX_RESPONSE_BYTES = 1024 * 1024;
const FETCH_MAX_CONCURRENT = 4;

interface ScriptFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export const injectHostApi = (context: QuickJSContext, env: HostApiEnv): void => {
  const { bindings } = env;

  const register = (name: string, fn: (...args: QuickJSHandle[]) => QuickJSHandle | undefined): void => {
    const handle = context.newFunction(name, fn);
    context.setProp(context.global, name, handle);
    handle.dispose();
  };

  register('__host_say', (target, text) => {
    bindings.say(context.getString(target), context.getString(text));
    return undefined;
  });

  register('__host_sendRaw', (line) => {
    bindings.sendRaw(context.getString(line));
    return undefined;
  });

  register('__host_print', (text, target) => {
    // Bootstrap passes '' when the script gave no target
    const targetString = context.getString(target);
    bindings.print(context.getString(text), targetString === '' ? undefined : targetString);
    return undefined;
  });

  register('__host_registerCommand', (name, aliasesJson) => {
    const aliases = JSON.parse(context.getString(aliasesJson)) as string[];
    const rejected = bindings.registerCommand(context.getString(name), aliases);
    return context.newString(JSON.stringify(rejected));
  });

  register('__host_nick', () => context.newString(bindings.getNick()));

  register('__host_currentChannel', () => context.newString(bindings.getCurrentChannel()));

  let activeFetches = 0;

  const runHostFetch = async (url: string, optsJson: string): Promise<string> => {
    const protocol = new URL(url).protocol;
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error('sic.fetch: only http(s) URLs are allowed');
    }
    if (activeFetches >= FETCH_MAX_CONCURRENT) {
      throw new Error(`sic.fetch: more than ${FETCH_MAX_CONCURRENT} concurrent requests`);
    }
    const fetchImpl = bindings.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);
    env.abortControllers.add(controller);
    activeFetches += 1;
    try {
      const opts = JSON.parse(optsJson) as ScriptFetchOptions;
      const response = await fetchImpl(url, {
        method: opts.method,
        headers: opts.headers,
        body: opts.body,
        signal: controller.signal,
      });
      const body = await response.text();
      if (body.length > FETCH_MAX_RESPONSE_BYTES) {
        throw new Error('sic.fetch: response larger than 1 MB');
      }
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      return JSON.stringify({ ok: response.ok, status: response.status, headers, body });
    } finally {
      clearTimeout(timeout);
      env.abortControllers.delete(controller);
      activeFetches -= 1;
    }
  };

  register('__host_fetch', (urlHandle, optsHandle) => {
    const url = context.getString(urlHandle);
    const optsJson = context.getString(optsHandle);
    const deferred = context.newPromise();
    env.liveDeferreds.add(deferred);

    void runHostFetch(url, optsJson)
      .then(
        (resultJson) => {
          if (!env.isContextAlive()) { return; }
          const value = context.newString(resultJson);
          deferred.resolve(value);
          value.dispose();
        },
        (error: unknown) => {
          if (!env.isContextAlive()) { return; }
          const errorHandle = context.newError(error instanceof Error ? error.message : String(error));
          deferred.reject(errorHandle);
          errorHandle.dispose();
        },
      )
      .catch(() => {
        // The context can be disposed between the alive check and the settle
        // call; there is nothing left to notify then
      });

    // Promise callbacks inside the VM only run via executePendingJobs
    void deferred.settled
      .catch(() => {
        // settled never rejects today; guard against future library changes
      })
      .then(() => { env.runPendingJobs(); })
      .finally(() => {
        env.liveDeferreds.delete(deferred);
        if (env.isContextAlive() && deferred.alive) { deferred.dispose(); }
      })
      .catch(() => {
        // Disposal raced the cleanup — nothing left to release
      });

    return deferred.handle;
  });
};
