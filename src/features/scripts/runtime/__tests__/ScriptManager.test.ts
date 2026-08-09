import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ircSendRawMessage } from '@/network/irc/network';
import { useScriptsStore, addScript, setScriptEnabled, updateScript } from '../../store/scripts';
import { syncScripts, disposeAllScriptRuntimes } from '../ScriptManager';
import { runScriptHook } from '../../hook';
import { hasScriptCommand, dispatchScriptCommand } from '../commandRegistry';
import type { ScriptEvent } from '../../types';

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

const messageEvent = (text: string): ScriptEvent =>
  ({ type: 'message', nick: 'alice', target: '#chan', text, self: false, tags: {} });

const enableScript = async (name: string, source: string): Promise<string> => {
  const id = addScript(name, source);
  setScriptEnabled(id, true);
  await syncScripts();
  return id;
};

describe('ScriptManager', () => {
  beforeEach(async () => {
    await disposeAllScriptRuntimes();
    useScriptsStore.setState({ scripts: {}, runtimeErrors: {} });
    vi.mocked(ircSendRawMessage).mockClear();
  });

  afterEach(async () => {
    await disposeAllScriptRuntimes();
  });

  it('passes events through when no scripts are enabled', async () => {
    await syncScripts();
    expect(runScriptHook(messageEvent('hi'))).toEqual({ blocked: false });
  });

  it('runs an enabled script against kernel events', async () => {
    await enableScript('blocker', "sic.on('message', (e) => { if (e.text.includes('spam')) e.block(); });");
    expect(runScriptHook(messageEvent('buy spam'))).toEqual({ blocked: true });
    expect(runScriptHook(messageEvent('hello'))).toEqual({ blocked: false });
  });

  it('chains text modifications across scripts in creation order', async () => {
    await enableScript('upper', "sic.on('message', (e) => { e.text = e.text.toUpperCase(); });");
    await enableScript('suffix', "sic.on('message', (e) => { e.text = e.text + '!'; });");
    expect(runScriptHook(messageEvent('hi'))).toEqual({ blocked: false, text: 'HI!' });
  });

  it('registers script commands and routes them to the owning script', async () => {
    await enableScript('slapper', "sic.command('slap', (args, channel) => { sic.say(channel, 'slaps ' + args); });");
    expect(hasScriptCommand('slap')).toBe(true);
    dispatchScriptCommand('slap', 'bob', '#irc');
    expect(ircSendRawMessage).toHaveBeenCalledWith('PRIVMSG #irc :slaps bob');
  });

  it('strips CRLF from sic.say so scripts cannot inject raw commands', async () => {
    await enableScript('sneaky', String.raw`sic.command('x', () => { sic.say('#irc', 'hi\r\nQUIT :bye'); });`);
    dispatchScriptCommand('x', '', '#irc');
    expect(ircSendRawMessage).toHaveBeenCalledWith('PRIVMSG #irc :hiQUIT :bye');
  });

  it('tears down a disabled script (hook and commands)', async () => {
    const id = await enableScript('blocker', "sic.command('zap', () => {}); sic.on('message', (e) => e.block());");
    expect(runScriptHook(messageEvent('hi')).blocked).toBe(true);
    setScriptEnabled(id, false);
    await syncScripts();
    expect(runScriptHook(messageEvent('hi'))).toEqual({ blocked: false });
    expect(hasScriptCommand('zap')).toBe(false);
  });

  it('reports a load error and does not retry the same broken source', async () => {
    const id = await enableScript('broken', 'not valid js');
    expect(useScriptsStore.getState().runtimeErrors[id]?.message).toMatch(/SyntaxError/);
    expect(runScriptHook(messageEvent('hi'))).toEqual({ blocked: false });
    useScriptsStore.getState().setRuntimeError(id, undefined);
    await syncScripts();
    expect(useScriptsStore.getState().runtimeErrors[id]).toBeUndefined();
  });

  it('reloads an enabled script when its source changes', async () => {
    const id = await enableScript('mutable', "sic.on('message', (e) => { e.text = 'v1'; });");
    expect(runScriptHook(messageEvent('hi'))).toEqual({ blocked: false, text: 'v1' });
    updateScript(id, { source: "sic.on('message', (e) => { e.text = 'v2'; });" });
    await syncScripts();
    expect(runScriptHook(messageEvent('hi'))).toEqual({ blocked: false, text: 'v2' });
  });

  it('recovers a previously broken script after the source is fixed', async () => {
    const id = await enableScript('fixme', 'not valid js');
    updateScript(id, { source: "sic.on('message', (e) => e.block());" });
    await syncScripts();
    expect(runScriptHook(messageEvent('hi')).blocked).toBe(true);
    expect(useScriptsStore.getState().runtimeErrors[id]).toBeUndefined();
  });
});
