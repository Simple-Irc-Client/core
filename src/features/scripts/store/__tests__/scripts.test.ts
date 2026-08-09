import { describe, expect, it, beforeEach } from 'vitest';
import {
  useScriptsStore,
  addScript,
  updateScript,
  deleteScript,
  setScriptEnabled,
  setRuntimeError,
  getEnabledScripts,
} from '../scripts';

describe('scripts store', () => {
  beforeEach(() => {
    useScriptsStore.setState({ scripts: {}, runtimeErrors: {} });
  });

  it('adds a script disabled by default', () => {
    const id = addScript('My script', 'sic.print("hi")');
    const script = useScriptsStore.getState().scripts[id];
    expect(script?.name).toBe('My script');
    expect(script?.source).toBe('sic.print("hi")');
    expect(script?.enabled).toBe(false);
    expect(script?.createdAt).toBe(script?.updatedAt);
  });

  it('updates name/source and bumps updatedAt', async () => {
    const id = addScript('a', 'x');
    const before = useScriptsStore.getState().scripts[id]?.updatedAt ?? '';
    await new Promise((resolve) => setTimeout(resolve, 5));
    updateScript(id, { source: 'y' });
    const after = useScriptsStore.getState().scripts[id];
    expect(after?.source).toBe('y');
    expect(after?.name).toBe('a');
    expect((after?.updatedAt ?? '') > before).toBe(true);
  });

  it('ignores updates to unknown ids', () => {
    updateScript('missing', { source: 'y' });
    expect(useScriptsStore.getState().scripts).toEqual({});
  });

  it('toggles enabled and lists enabled scripts', () => {
    const id1 = addScript('a', 'x');
    addScript('b', 'y');
    setScriptEnabled(id1, true);
    const enabled = getEnabledScripts();
    expect(enabled).toHaveLength(1);
    expect(enabled[0]?.id).toBe(id1);
  });

  it('deletes a script and its runtime error', () => {
    const id = addScript('a', 'x');
    setRuntimeError(id, { message: 'boom', time: new Date().toISOString() });
    deleteScript(id);
    expect(useScriptsStore.getState().scripts[id]).toBeUndefined();
    expect(id in useScriptsStore.getState().runtimeErrors).toBe(false);
  });

  it('sets and clears runtime errors', () => {
    const id = addScript('a', 'x');
    setRuntimeError(id, { message: 'boom', time: new Date().toISOString() });
    expect(useScriptsStore.getState().runtimeErrors[id]?.message).toBe('boom');
    setRuntimeError(id, undefined);
    expect(useScriptsStore.getState().runtimeErrors[id]).toBeUndefined();
  });
});
