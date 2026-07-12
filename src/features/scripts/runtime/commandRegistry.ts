import { generalCommands, channelCommands } from '@/network/irc/command';

/**
 * Host-side registry of slash commands registered by scripts.
 * Engine-free: command.ts consults it synchronously; the actual dispatch
 * into a script VM goes through the dispatcher installed by ScriptManager.
 */
export type ScriptCommandDispatcher = (scriptId: string, canonical: string, args: string, channel: string) => void;

interface RegisteredCommand {
  scriptId: string;
  canonical: string;
}

// Lazy: command.ts imports this module back (hasScriptCommand), so the
// builtin arrays are not initialized yet while this module evaluates
let builtinCommands: Set<string> | null = null;
const getBuiltinCommands = (): Set<string> =>
  (builtinCommands ??= new Set([...generalCommands, ...channelCommands].map((name) => name.substring(1).toLowerCase())));

const registry = new Map<string, RegisteredCommand>();

// Stable snapshot + subscription so Toolbar autocomplete can consume the
// registry via useSyncExternalStore
let namesSnapshot: string[] = [];
const listeners = new Set<() => void>();
const notifyChanged = (): void => {
  namesSnapshot = [...registry.keys()].map((name) => `/${name}`);
  listeners.forEach((listener) => { listener(); });
};

export const subscribeScriptCommands = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

let commandDispatcher: ScriptCommandDispatcher | null = null;

export const setScriptCommandDispatcher = (dispatcher: ScriptCommandDispatcher | null): void => {
  commandDispatcher = dispatcher;
};

/** Registers a command (and aliases) for a script. Returns the names that were rejected as collisions. */
export const registerScriptCommand = (scriptId: string, name: string, aliases: string[] = []): string[] => {
  const rejected: string[] = [];
  const canonical = name.toLowerCase();
  for (const candidate of [canonical, ...aliases.map((alias) => alias.toLowerCase())]) {
    const owner = registry.get(candidate);
    if (getBuiltinCommands().has(candidate) || (owner !== undefined && owner.scriptId !== scriptId)) {
      rejected.push(candidate);
      continue;
    }
    registry.set(candidate, { scriptId, canonical });
  }
  notifyChanged();
  return rejected;
};

export const unregisterScriptCommands = (scriptId: string): void => {
  for (const [name, entry] of registry) {
    if (entry.scriptId === scriptId) {
      registry.delete(name);
    }
  }
  notifyChanged();
};

export const hasScriptCommand = (name: string): boolean => registry.has(name.toLowerCase());

export const getScriptCommandNames = (): string[] => namesSnapshot;

export const dispatchScriptCommand = (name: string, args: string, channel: string): void => {
  const entry = registry.get(name.toLowerCase());
  if (entry === undefined || commandDispatcher === null) {
    return;
  }
  try {
    commandDispatcher(entry.scriptId, entry.canonical, args, channel);
  } catch (error) {
    console.error('Script command dispatch failed:', error);
  }
};
