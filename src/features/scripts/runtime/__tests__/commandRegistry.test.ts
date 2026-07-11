import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  registerScriptCommand,
  unregisterScriptCommands,
  hasScriptCommand,
  getScriptCommandNames,
  dispatchScriptCommand,
  setScriptCommandDispatcher,
} from '../commandRegistry';

describe('commandRegistry', () => {
  beforeEach(() => {
    unregisterScriptCommands('s1');
    unregisterScriptCommands('s2');
    setScriptCommandDispatcher(null);
  });

  it('registers a command with aliases', () => {
    const rejected = registerScriptCommand('s1', 'slap', ['trout']);
    expect(rejected).toEqual([]);
    expect(hasScriptCommand('slap')).toBe(true);
    expect(hasScriptCommand('SLAP')).toBe(true);
    expect(hasScriptCommand('trout')).toBe(true);
    expect(getScriptCommandNames()).toEqual(expect.arrayContaining(['/slap', '/trout']));
  });

  it('rejects collisions with builtin commands', () => {
    const rejected = registerScriptCommand('s1', 'join');
    expect(rejected).toEqual(['join']);
    expect(hasScriptCommand('join')).toBe(false);
  });

  it('rejects collisions with other scripts but allows re-registration by owner', () => {
    registerScriptCommand('s1', 'slap');
    expect(registerScriptCommand('s2', 'slap')).toEqual(['slap']);
    expect(registerScriptCommand('s1', 'slap')).toEqual([]);
  });

  it('unregisters all commands of a script', () => {
    registerScriptCommand('s1', 'slap', ['trout']);
    registerScriptCommand('s2', 'hug');
    unregisterScriptCommands('s1');
    expect(hasScriptCommand('slap')).toBe(false);
    expect(hasScriptCommand('trout')).toBe(false);
    expect(hasScriptCommand('hug')).toBe(true);
  });

  it('dispatches to the installed dispatcher with the canonical name', () => {
    const dispatcher = vi.fn();
    setScriptCommandDispatcher(dispatcher);
    registerScriptCommand('s1', 'slap', ['trout']);
    dispatchScriptCommand('TROUT', 'victim hard', '#chan');
    expect(dispatcher).toHaveBeenCalledWith('s1', 'slap', 'victim hard', '#chan');
  });

  it('is a no-op without a dispatcher or for unknown commands', () => {
    expect(() => dispatchScriptCommand('slap', '', '#chan')).not.toThrow();
    const dispatcher = vi.fn();
    setScriptCommandDispatcher(dispatcher);
    dispatchScriptCommand('unknown', '', '#chan');
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('contains dispatcher exceptions', () => {
    setScriptCommandDispatcher(() => { throw new Error('boom'); });
    registerScriptCommand('s1', 'slap');
    expect(() => dispatchScriptCommand('slap', '', '#chan')).not.toThrow();
  });
});
