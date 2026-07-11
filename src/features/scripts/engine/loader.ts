import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from 'quickjs-emscripten-core';
import releaseSyncVariant from '@jitl/quickjs-wasmfile-release-sync';

// This module (and everything under engine/) must only ever be reached via
// dynamic import from ScriptManager, so the ~1MB QuickJS WASM stays out of
// the main bundle and is fetched only when a script is enabled.
//
// Depends on the single release-sync variant directly (instead of the
// `quickjs-emscripten` umbrella) so the build emits exactly one WASM binary.
let modulePromise: Promise<QuickJSWASMModule> | undefined;

export const loadQuickJS = (): Promise<QuickJSWASMModule> =>
  (modulePromise ??= newQuickJSWASMModuleFromVariant(releaseSyncVariant));
