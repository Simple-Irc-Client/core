import { type ScriptEvent, type ScriptEventResult, PASS_THROUGH } from './types';

/**
 * Engine-free facade between the IRC kernel and the scripting engine.
 * The kernel only ever imports this module; the QuickJS engine registers
 * itself here once it is lazily loaded, so with no enabled scripts the
 * hook is a no-op and no engine code is in the bundle.
 */
export type ScriptDispatcher = (event: ScriptEvent) => ScriptEventResult;

let dispatcher: ScriptDispatcher | null = null;

export const setScriptDispatcher = (newDispatcher: ScriptDispatcher | null): void => {
  dispatcher = newDispatcher;
};

export const runScriptHook = (event: ScriptEvent): ScriptEventResult => {
  if (dispatcher === null) {
    return PASS_THROUGH;
  }
  try {
    return dispatcher(event);
  } catch (error) {
    // A script (or the engine itself) must never break message handling
    console.error('Script dispatcher failed:', error);
    return PASS_THROUGH;
  }
};
