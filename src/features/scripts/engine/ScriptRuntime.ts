import type { QuickJSContext, QuickJSHandle, QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten-core';
import { type ScriptEvent, type ScriptEventResult, PASS_THROUGH } from '../types';
import { BOOTSTRAP_SOURCE } from './bootstrap';
import { injectHostApi, type HostBindings } from './hostApi';

export interface ScriptRuntimeLimits {
  memoryBytes: number;
  stackBytes: number;
  /** Interrupt budget for evaluating the script source on load */
  evalBudgetMs: number;
  /** Interrupt budget per event/command dispatch and pending-jobs drain */
  dispatchBudgetMs: number;
}

const DEFAULT_LIMITS: ScriptRuntimeLimits = {
  memoryBytes: 32 * 1024 * 1024,
  stackBytes: 512 * 1024,
  evalBudgetMs: 500,
  dispatchBudgetMs: 50,
};

const NO_DEADLINE = Number.MAX_SAFE_INTEGER;

export interface ScriptRuntimeOptions {
  scriptId: string;
  source: string;
  bindings: HostBindings;
  /** Runtime errors (dispatch/promise-job failures); load errors throw from the constructor instead */
  onError: (message: string) => void;
  limits?: Partial<ScriptRuntimeLimits>;
}

/**
 * One QuickJS runtime + context per script: isolates scripts from each
 * other and gives each its own memory limit and interrupt budget.
 * The constructor throws (fully disposed) if the script source fails to
 * evaluate; after construction all errors are contained and reported
 * through onError while events pass through unmodified.
 */
export class ScriptRuntime {
  readonly scriptId: string;

  private readonly runtime: QuickJSRuntime;
  private readonly context: QuickJSContext;
  private readonly limits: ScriptRuntimeLimits;
  private readonly onError: (message: string) => void;
  private readonly abortControllers = new Set<AbortController>();
  private readonly liveDeferreds = new Set<{ alive: boolean; dispose: () => void }>();
  private dispatchFn: QuickJSHandle | null = null;
  private deadline = NO_DEADLINE;
  private disposed = false;

  constructor(quickjs: QuickJSWASMModule, options: ScriptRuntimeOptions) {
    this.scriptId = options.scriptId;
    this.onError = options.onError;
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };

    this.runtime = quickjs.newRuntime();
    this.runtime.setMemoryLimit(this.limits.memoryBytes);
    this.runtime.setMaxStackSize(this.limits.stackBytes);
    this.runtime.setInterruptHandler(() => Date.now() > this.deadline);
    this.context = this.runtime.newContext();

    try {
      injectHostApi(this.context, {
        bindings: options.bindings,
        abortControllers: this.abortControllers,
        liveDeferreds: this.liveDeferreds,
        isContextAlive: () => !this.disposed && this.context.alive,
        runPendingJobs: () => { this.runPendingJobs(); },
      });

      this.deadline = Date.now() + this.limits.evalBudgetMs;
      this.evalOrThrow(BOOTSTRAP_SOURCE);
      // Capture dispatch before the user script runs, so a script
      // replacing globalThis.__sic_dispatch cannot hijack it
      this.dispatchFn = this.context.getProp(this.context.global, '__sic_dispatch');

      this.deadline = Date.now() + this.limits.evalBudgetMs;
      this.evalOrThrow(options.source);
    } catch (error) {
      this.dispose();
      throw error;
    } finally {
      this.deadline = NO_DEADLINE;
    }
  }

  dispatchEvent(event: ScriptEvent): ScriptEventResult {
    return this.dispatch('event', event);
  }

  dispatchCommand(name: string, args: string, channel: string): void {
    this.dispatch('command', { name, args, channel });
  }

  dispose(): void {
    if (this.disposed) { return; }
    this.disposed = true;
    for (const controller of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();
    for (const deferred of this.liveDeferreds) {
      if (deferred.alive) { deferred.dispose(); }
    }
    this.liveDeferreds.clear();
    if (this.dispatchFn?.alive) { this.dispatchFn.dispose(); }
    if (this.context.alive) { this.context.dispose(); }
    if (this.runtime.alive) { this.runtime.dispose(); }
  }

  get alive(): boolean {
    return !this.disposed;
  }

  private dispatch(kind: 'event' | 'command', payload: unknown): ScriptEventResult {
    if (this.disposed || this.dispatchFn === null) { return PASS_THROUGH; }

    this.deadline = Date.now() + this.limits.dispatchBudgetMs;
    const kindHandle = this.context.newString(kind);
    const payloadHandle = this.context.newString(JSON.stringify(payload));
    try {
      const result = this.context.callFunction(this.dispatchFn, this.context.undefined, kindHandle, payloadHandle);
      if ('error' in result && result.error !== undefined) {
        this.onError(this.dumpError(result.error));
        return PASS_THROUGH;
      }
      const resultJson = this.context.getString(result.value);
      result.value.dispose();
      const parsed = JSON.parse(resultJson) as ScriptEventResult;
      return {
        blocked: parsed.blocked === true,
        ...(typeof parsed.text === 'string' ? { text: parsed.text } : {}),
      };
    } catch (error) {
      this.onError(error instanceof Error ? error.message : String(error));
      return PASS_THROUGH;
    } finally {
      kindHandle.dispose();
      payloadHandle.dispose();
      this.deadline = NO_DEADLINE;
      this.runPendingJobs();
    }
  }

  /** Runs queued VM promise callbacks (e.g. sic.fetch continuations) under a fresh budget */
  private runPendingJobs(): void {
    if (this.disposed) { return; }
    this.deadline = Date.now() + this.limits.dispatchBudgetMs;
    try {
      const result = this.runtime.executePendingJobs();
      if ('error' in result && result.error !== undefined) {
        this.onError(this.dumpError(result.error));
      }
    } catch (error) {
      this.onError(error instanceof Error ? error.message : String(error));
    } finally {
      this.deadline = NO_DEADLINE;
    }
  }

  private evalOrThrow(code: string): void {
    const result = this.context.evalCode(code);
    if ('error' in result && result.error !== undefined) {
      throw new Error(this.dumpError(result.error));
    }
    result.value.dispose();
  }

  private dumpError(errorHandle: QuickJSHandle): string {
    try {
      const dumped: unknown = this.context.dump(errorHandle);
      if (typeof dumped === 'object' && dumped !== null && 'message' in dumped) {
        const { name, message } = dumped as { name?: string; message?: string };
        return name !== undefined && name !== '' ? `${name}: ${message ?? ''}` : String(message);
      }
      return typeof dumped === 'string' ? dumped : JSON.stringify(dumped);
    } finally {
      errorHandle.dispose();
    }
  }
}
