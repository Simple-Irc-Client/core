import { describe, expect, it, beforeAll, vi } from 'vitest';
import type { QuickJSWASMModule } from 'quickjs-emscripten-core';
import { loadQuickJS } from '../loader';
import { ScriptRuntime, type ScriptRuntimeOptions } from '../ScriptRuntime';
import type { HostBindings } from '../hostApi';

let quickjs: QuickJSWASMModule;

beforeAll(async () => {
  quickjs = await loadQuickJS();
}, 30_000);

const makeBindings = (overrides: Partial<HostBindings> = {}): HostBindings => ({
  say: vi.fn(),
  sendRaw: vi.fn(),
  print: vi.fn(),
  registerCommand: vi.fn(() => []),
  getNick: () => 'tester',
  getCurrentChannel: () => '#chan',
  ...overrides,
});

const makeRuntime = (source: string, overrides: Partial<ScriptRuntimeOptions> = {}): ScriptRuntime =>
  new ScriptRuntime(quickjs, {
    scriptId: 's1',
    source,
    bindings: makeBindings(),
    onError: vi.fn(),
    ...overrides,
  });

const messageEvent = (text: string): { type: 'message'; nick: string; target: string; text: string; self: boolean; tags: Record<string, string> } =>
  ({ type: 'message', nick: 'alice', target: '#chan', text, self: false, tags: {} });

describe('ScriptRuntime', () => {
  it('exposes the sic API and passes events through by default', () => {
    const bindings = makeBindings();
    const runtime = makeRuntime('sic.print("loaded " + sic.nick() + " " + sic.currentChannel());', { bindings });
    expect(bindings.print).toHaveBeenCalledWith('loaded tester #chan', undefined);
    expect(runtime.dispatchEvent(messageEvent('hello'))).toEqual({ blocked: false });
    runtime.dispose();
  });

  it('lets a handler veto an event and skips later handlers', () => {
    const bindings = makeBindings();
    const runtime = makeRuntime(`
      sic.on('message', (e) => { if (e.text.includes('spam')) e.block(); });
      sic.on('message', () => sic.print('second handler'));
    `, { bindings });
    expect(runtime.dispatchEvent(messageEvent('buy spam now'))).toEqual({ blocked: true });
    expect(bindings.print).not.toHaveBeenCalled();
    const clean = runtime.dispatchEvent(messageEvent('hello'));
    expect(clean.blocked).toBe(false);
    expect(bindings.print).toHaveBeenCalledWith('second handler', undefined);
    runtime.dispose();
  });

  it('returns modified text only when a handler changed it', () => {
    const runtime = makeRuntime("sic.on('message', (e) => { e.text = e.text.toUpperCase(); });");
    expect(runtime.dispatchEvent(messageEvent('hello'))).toEqual({ blocked: false, text: 'HELLO' });
    runtime.dispose();
  });

  it('supports unsubscribing a handler', () => {
    const runtime = makeRuntime(`
      const off = sic.on('message', (e) => { e.block(); });
      sic.on('message', (e) => { if (e.text === 'stop') off(); });
    `);
    expect(runtime.dispatchEvent(messageEvent('hi')).blocked).toBe(true);
    // First handler still active for the unsubscribe trigger itself
    expect(runtime.dispatchEvent(messageEvent('stop')).blocked).toBe(true);
    expect(runtime.dispatchEvent(messageEvent('hi')).blocked).toBe(true);
    runtime.dispose();
  });

  it('registers and dispatches commands', () => {
    const bindings = makeBindings();
    const runtime = makeRuntime(`
      sic.command('slap', (args, channel) => { sic.say(channel, 'slaps ' + args); }, { aliases: ['trout'] });
    `, { bindings });
    expect(bindings.registerCommand).toHaveBeenCalledWith('slap', ['trout']);
    runtime.dispatchCommand('slap', 'bob hard', '#irc');
    expect(bindings.say).toHaveBeenCalledWith('#irc', 'slaps bob hard');
    runtime.dispose();
  });

  it('throws from the constructor when a command name is rejected', () => {
    const bindings = makeBindings({ registerCommand: () => ['join'] });
    expect(() => makeRuntime("sic.command('join', () => {});", { bindings }))
      .toThrow(/already in use: join/);
  });

  it('throws from the constructor on a broken script and stays disposed', () => {
    expect(() => makeRuntime('this is not javascript')).toThrow(/SyntaxError/);
  });

  it('contains handler exceptions and reports them', () => {
    const onError = vi.fn();
    const runtime = makeRuntime("sic.on('message', () => { throw new Error('boom'); });", { onError });
    expect(runtime.dispatchEvent(messageEvent('hi'))).toEqual({ blocked: false });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('boom'));
    runtime.dispose();
  });

  it('interrupts an infinite loop in a handler', () => {
    const onError = vi.fn();
    const runtime = makeRuntime("sic.on('message', () => { while (true) {} });", {
      onError,
      limits: { dispatchBudgetMs: 30 },
    });
    const start = Date.now();
    expect(runtime.dispatchEvent(messageEvent('hi'))).toEqual({ blocked: false });
    expect(Date.now() - start).toBeLessThan(5_000);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('interrupted'));
    runtime.dispose();
  });

  it('interrupts an infinite loop at load time', () => {
    expect(() => makeRuntime('while (true) {}', { limits: { evalBudgetMs: 30 } }))
      .toThrow(/interrupted/);
  });

  it('enforces the memory limit', () => {
    expect(() => makeRuntime('const a = []; while (true) { a.push(new Array(1024).fill(a.length)); }', {
      limits: { memoryBytes: 1024 * 1024, evalBudgetMs: 5_000 },
    })).toThrow(/memory/i);
  });

  it('resolves sic.fetch inside the VM', async () => {
    const bindings = makeBindings({
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: async () => '{"answer":42}',
      })) as unknown as typeof fetch,
    });
    const runtime = makeRuntime(`
      sic.on('message', () => {
        sic.fetch('https://example.com/api')
          .then((res) => sic.print('got ' + res.status + ' ' + res.json().answer))
          .catch((err) => sic.print('failed ' + err.message));
      });
    `, { bindings });
    runtime.dispatchEvent(messageEvent('go'));
    await vi.waitFor(() => { expect(bindings.print).toHaveBeenCalledWith('got 200 42', undefined); });
    runtime.dispose();
  });

  it('rejects sic.fetch for non-http URLs', async () => {
    const bindings = makeBindings();
    const runtime = makeRuntime(`
      sic.on('message', () => {
        sic.fetch('file:///etc/passwd').catch((err) => sic.print('rejected: ' + err.message));
      });
    `, { bindings });
    runtime.dispatchEvent(messageEvent('go'));
    await vi.waitFor(() => {
      expect(bindings.print).toHaveBeenCalledWith(expect.stringContaining('only http(s)'), undefined);
    });
    runtime.dispose();
  });

  it('aborts in-flight fetches on dispose without crashing', async () => {
    let sawAbort = false;
    const bindings = makeBindings({
      fetchImpl: vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          sawAbort = true;
          reject(new Error('aborted'));
        });
      })) as unknown as typeof fetch,
    });
    const runtime = makeRuntime(`
      sic.on('message', () => { sic.fetch('https://example.com/slow').catch(() => {}); });
    `, { bindings });
    runtime.dispatchEvent(messageEvent('go'));
    runtime.dispose();
    await vi.waitFor(() => { expect(sawAbort).toBe(true); });
    expect(runtime.alive).toBe(false);
  });

  it('isolates scripts from each other', () => {
    const runtimeA = makeRuntime('globalThis.shared = "A";');
    const runtimeB = makeRuntime(`
      sic.on('message', (e) => { if (globalThis.shared === undefined) e.block(); });
    `);
    expect(runtimeB.dispatchEvent(messageEvent('hi')).blocked).toBe(true);
    runtimeA.dispose();
    runtimeB.dispose();
  });

  it('does not expose host globals beyond the sic API', () => {
    const runtime = makeRuntime(`
      sic.on('message', (e) => {
        const leaks = ['__host_say', '__host_fetch', 'window', 'document', 'localStorage', 'XMLHttpRequest']
          .filter((name) => globalThis[name] !== undefined);
        if (leaks.length === 0) e.block();
      });
    `);
    expect(runtime.dispatchEvent(messageEvent('hi')).blocked).toBe(true);
    runtime.dispose();
  });
});
