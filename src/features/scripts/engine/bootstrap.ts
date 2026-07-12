/**
 * Source evaluated INSIDE each QuickJS VM before the user script.
 * Builds the frozen `sic` API over the injected `__host_*` primitives
 * (which it captures and removes from the global scope), keeps the
 * event/command handler registries inside the VM, and exposes a single
 * `__sic_dispatch(kind, payloadJson) => resultJson` entry point.
 *
 * The host captures a handle to `__sic_dispatch` before evaluating the
 * user script, so a script replacing the global cannot hijack dispatch.
 */
export const BOOTSTRAP_SOURCE = `
(() => {
  const hostSay = globalThis.__host_say;
  const hostSendRaw = globalThis.__host_sendRaw;
  const hostPrint = globalThis.__host_print;
  const hostRegisterCommand = globalThis.__host_registerCommand;
  const hostNick = globalThis.__host_nick;
  const hostCurrentChannel = globalThis.__host_currentChannel;
  const hostFetch = globalThis.__host_fetch;
  delete globalThis.__host_say;
  delete globalThis.__host_sendRaw;
  delete globalThis.__host_print;
  delete globalThis.__host_registerCommand;
  delete globalThis.__host_nick;
  delete globalThis.__host_currentChannel;
  delete globalThis.__host_fetch;

  const handlers = Object.create(null);
  const commands = Object.create(null);

  const sic = {
    version: '1',
    on(event, handler) {
      if (typeof handler !== 'function') { throw new TypeError('sic.on: handler must be a function'); }
      const name = String(event);
      (handlers[name] || (handlers[name] = [])).push(handler);
      return () => {
        const list = handlers[name];
        if (!list) { return; }
        const index = list.indexOf(handler);
        if (index !== -1) { list.splice(index, 1); }
      };
    },
    command(name, handler, opts) {
      if (typeof handler !== 'function') { throw new TypeError('sic.command: handler must be a function'); }
      const canonical = String(name).toLowerCase();
      const aliases = (opts && opts.aliases ? opts.aliases : []).map((alias) => String(alias).toLowerCase());
      const rejected = JSON.parse(hostRegisterCommand(canonical, JSON.stringify(aliases)));
      if (rejected.length > 0) { throw new Error('sic.command: name(s) already in use: ' + rejected.join(', ')); }
      commands[canonical] = handler;
    },
    say(target, text) { hostSay(String(target), String(text)); },
    sendRaw(line) { hostSendRaw(String(line)); },
    print(text, target) { hostPrint(String(text), target === undefined || target === null ? '' : String(target)); },
    nick() { return hostNick(); },
    currentChannel() { return hostCurrentChannel(); },
    fetch(url, opts) {
      return hostFetch(String(url), JSON.stringify(opts || {})).then((resultJson) => {
        const result = JSON.parse(resultJson);
        return {
          ok: result.ok,
          status: result.status,
          headers: result.headers,
          body: result.body,
          json() { return JSON.parse(result.body); },
        };
      });
    },
    // Reserved for future API versions — present so scripts can feature-detect
    timers: Object.freeze({}),
    storage: Object.freeze({}),
    ui: Object.freeze({}),
  };
  Object.freeze(sic);
  Object.defineProperty(globalThis, 'sic', { value: sic, writable: false, configurable: false });

  globalThis.__sic_dispatch = (kind, payloadJson) => {
    const payload = JSON.parse(payloadJson);
    if (kind === 'command') {
      const handler = commands[payload.name];
      if (handler) { handler(payload.args, payload.channel); }
      return '{"blocked":false}';
    }
    const list = handlers[payload.type];
    if (!list || list.length === 0) { return '{"blocked":false}'; }
    let blocked = false;
    const originalText = payload.text;
    const event = payload;
    event.block = () => { blocked = true; };
    for (const handler of list.slice()) {
      handler(event);
      if (blocked) { break; }
    }
    const result = { blocked };
    if (typeof event.text === 'string' && event.text !== originalText) { result.text = event.text; }
    return JSON.stringify(result);
  };
})();
`;
