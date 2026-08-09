import { v4 as uuidv4 } from 'uuid';
import type { QuickJSWASMModule } from 'quickjs-emscripten-core';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageCategory } from '@shared/types';
import { MessageColor } from '@/config/theme';
import { setAddMessage } from '@features/channels/store/channels';
import { getCurrentNick, getCurrentChannelName } from '@features/settings/store/settings';
import { getUser } from '@features/users/store/users';
import { ircSendRawMessage } from '@/network/irc/network';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { setScriptDispatcher } from '../hook';
import { registerScriptCommand, unregisterScriptCommands, setScriptCommandDispatcher } from './commandRegistry';
import { useScriptsStore, getEnabledScripts, setRuntimeError } from '../store/scripts';
import { type ScriptEvent, type ScriptEventResult, PASS_THROUGH } from '../types';
import type { ScriptRuntime } from '../engine/ScriptRuntime';
import type { HostBindings } from '../engine/hostApi';

/**
 * Syncs the scripts store to live QuickJS runtimes. The engine (and its
 * ~1MB WASM) is dynamically imported only once a script actually needs to
 * run; with no enabled scripts the kernel hook stays a null dispatcher.
 */

interface EngineModule {
  quickjs: QuickJSWASMModule;
  ScriptRuntime: typeof ScriptRuntime;
}

let enginePromise: Promise<EngineModule> | null = null;

const ensureEngine = (): Promise<EngineModule> =>
  (enginePromise ??= (async () => {
    const [loaderModule, runtimeModule] = await Promise.all([
      import('../engine/loader'),
      import('../engine/ScriptRuntime'),
    ]);
    return { quickjs: await loaderModule.loadQuickJS(), ScriptRuntime: runtimeModule.ScriptRuntime };
  })());

const runtimes = new Map<string, ScriptRuntime>();
const loadedSources = new Map<string, string>();
// Sources that failed to eval — retried only after the user edits them
const failedSources = new Map<string, string>();
let orderedIds: string[] = [];
let syncQueue: Promise<void> = Promise.resolve();
let initialized = false;

const stripCRLF = (input: string): string => input.replace(/[\r\n]/g, '');

const reportError = (script: { id: string; name: string }, message: string): void => {
  setRuntimeError(script.id, { message, time: new Date().toISOString() });
  setAddMessage({
    id: uuidv4(),
    message: `[script:${script.name}] ${message}`,
    target: STATUS_CHANNEL,
    time: new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

const makeBindings = (scriptId: string): HostBindings => ({
  say: (target, text) => {
    const cleanTarget = stripCRLF(target).trim();
    const cleanText = stripCRLF(text);
    if (cleanTarget.length === 0 || cleanText.length === 0 || cleanTarget.includes(' ')) { return; }
    // Mirror Toolbar.handleSubmit: local echo only without echo-message,
    // otherwise the server echoes it back and the kernel adds it
    if (!isCapabilityEnabled('echo-message')) {
      const nick = getCurrentNick();
      setAddMessage({
        id: uuidv4(),
        message: cleanText,
        nick: getUser(nick) ?? nick,
        target: cleanTarget,
        time: new Date().toISOString(),
        category: MessageCategory.default,
        color: MessageColor.default,
      });
    }
    ircSendRawMessage(`PRIVMSG ${cleanTarget} :${cleanText}`);
  },
  sendRaw: (line) => {
    ircSendRawMessage(stripCRLF(line));
  },
  print: (text, target) => {
    setAddMessage({
      id: uuidv4(),
      message: text,
      target: target ?? getCurrentChannelName(),
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  },
  registerCommand: (name, aliases) => registerScriptCommand(scriptId, name, aliases),
  getNick: getCurrentNick,
  getCurrentChannel: getCurrentChannelName,
});

const dispatchToScripts = (event: ScriptEvent): ScriptEventResult => {
  let currentEvent = event;
  let modifiedText: string | undefined;
  for (const id of orderedIds) {
    const runtime = runtimes.get(id);
    if (runtime === undefined) { continue; }
    const result = runtime.dispatchEvent(currentEvent);
    if (result.blocked) {
      return { blocked: true };
    }
    if (result.text !== undefined && 'text' in currentEvent) {
      modifiedText = result.text;
      currentEvent = { ...currentEvent, text: result.text };
    }
  }
  return modifiedText === undefined ? PASS_THROUGH : { blocked: false, text: modifiedText };
};

const updateDispatchers = (): void => {
  if (runtimes.size === 0) {
    setScriptDispatcher(null);
    setScriptCommandDispatcher(null);
    return;
  }
  setScriptDispatcher(dispatchToScripts);
  setScriptCommandDispatcher((scriptId, canonical, args, channel) => {
    runtimes.get(scriptId)?.dispatchCommand(canonical, args, channel);
  });
};

const doSync = async (): Promise<void> => {
  const enabled = getEnabledScripts()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const enabledById = new Map(enabled.map((script) => [script.id, script]));

  for (const [id, runtime] of [...runtimes]) {
    const script = enabledById.get(id);
    if (script === undefined || script.source !== loadedSources.get(id)) {
      runtime.dispose();
      unregisterScriptCommands(id);
      runtimes.delete(id);
      loadedSources.delete(id);
    }
  }
  for (const id of [...failedSources.keys()]) {
    const script = enabledById.get(id);
    if (script === undefined || script.source !== failedSources.get(id)) {
      failedSources.delete(id);
    }
  }

  const toLoad = enabled.filter((script) => !runtimes.has(script.id) && !failedSources.has(script.id));
  if (toLoad.length > 0) {
    let engine: EngineModule;
    try {
      engine = await ensureEngine();
    } catch (error) {
      // Engine (WASM) failed to load — e.g. offline before it was cached, or
      // a CSP without 'wasm-unsafe-eval'. Surface it on every affected script
      // instead of failing silently; retried on the next store change.
      enginePromise = null;
      const message = `Script engine failed to load: ${error instanceof Error ? error.message : String(error)}`;
      for (const script of toLoad) {
        reportError(script, message);
      }
      orderedIds = enabled.filter((script) => runtimes.has(script.id)).map((script) => script.id);
      updateDispatchers();
      return;
    }
    const { quickjs, ScriptRuntime } = engine;
    for (const script of toLoad) {
      // Re-read after the async engine load — the user may have toggled/edited meanwhile
      const current = useScriptsStore.getState().scripts[script.id];
      if (current === undefined || !current.enabled || runtimes.has(current.id)) { continue; }
      try {
        const runtime = new ScriptRuntime(quickjs, {
          scriptId: current.id,
          source: current.source,
          bindings: makeBindings(current.id),
          onError: (message) => { reportError({ id: current.id, name: current.name }, message); },
        });
        runtimes.set(current.id, runtime);
        loadedSources.set(current.id, current.source);
        setRuntimeError(current.id, undefined);
      } catch (error) {
        unregisterScriptCommands(current.id);
        failedSources.set(current.id, current.source);
        reportError(current, error instanceof Error ? error.message : String(error));
      }
    }
  }

  orderedIds = enabled.filter((script) => runtimes.has(script.id)).map((script) => script.id);
  updateDispatchers();
};

export const syncScripts = (): Promise<void> =>
  (syncQueue = syncQueue.then(doSync).catch((error: unknown) => {
    console.error('Script sync failed:', error);
  }));

/** Called once from App bootstrap; safe to call again (no-op). */
export const initScripts = (): void => {
  if (initialized) { return; }
  initialized = true;
  useScriptsStore.subscribe((state, prevState) => {
    if (state.scripts !== prevState.scripts) {
      void syncScripts();
    }
  });
  // The store rehydrates asynchronously from IndexedDB
  const persistApi = useScriptsStore.persist;
  if (persistApi.hasHydrated()) {
    void syncScripts();
  } else {
    persistApi.onFinishHydration(() => { void syncScripts(); });
  }
};

/** Test-only: tear down all runtimes and reset module state */
export const disposeAllScriptRuntimes = async (): Promise<void> => {
  await syncQueue;
  for (const [id, runtime] of runtimes) {
    runtime.dispose();
    unregisterScriptCommands(id);
  }
  runtimes.clear();
  loadedSources.clear();
  failedSources.clear();
  orderedIds = [];
  updateDispatchers();
};
