export interface UserScript {
  id: string;
  name: string;
  source: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptError {
  message: string;
  time: string;
}

export type ScriptEvent =
  | { type: 'message'; nick: string; target: string; text: string; self: boolean; tags: Record<string, string> }
  | { type: 'notice'; nick: string; target: string; text: string; tags: Record<string, string> }
  | { type: 'join'; nick: string; channel: string }
  | { type: 'part'; nick: string; channel: string; reason: string }
  | { type: 'quit'; nick: string; reason: string }
  | { type: 'nick'; oldNick: string; newNick: string }
  | { type: 'raw'; line: string }
  | { type: 'connect' }
  | { type: 'disconnect' };

export type ScriptEventType = ScriptEvent['type'];

export interface ScriptEventResult {
  blocked: boolean;
  /** Present only when a script modified the event text */
  text?: string;
}

export const PASS_THROUGH: ScriptEventResult = { blocked: false };
