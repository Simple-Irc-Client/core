import { type FontFormatting } from '@features/settings/store/settings';
import { BodyKind } from '@features/e2ee/protocol';
import { isSessionActive } from '@features/e2ee/store/e2ee';
import { IRC_FORMAT } from '@/shared/lib/ircFormatting';
import { ACTION_BODY, PRIVMSG_OR_NOTICE } from '@features/chat/ownMessages';

export type OutgoingCommandGate =
  | { verdict: 'encrypt'; target: string; kind: BodyKind; body: string }
  | { verdict: 'block'; target: string };

/**
 * Gates a command's wire line (not its name, so every command producing PRIVMSG/NOTICE is covered)
 * addressed to a peer with an active E2EE session: PRIVMSG is encrypted, NOTICE is blocked since it
 * has no encrypted form. Callers must send to the returned `target`, not the open window.
 */
export const gateOutgoingCommand = (payload: string): OutgoingCommandGate | null => {
  if (payload.includes('\n')) {
    return null;
  }

  const match = PRIVMSG_OR_NOTICE.exec(payload);
  if (!match) {
    return null;
  }

  const verb = (match[1] ?? '').toUpperCase();
  const target = match[2] ?? '';
  const body = match[3] ?? '';
  if (!isSessionActive(target)) {
    return null;
  }

  if (verb === 'NOTICE') {
    return { verdict: 'block', target };
  }

  const action = ACTION_BODY.exec(body);
  return action
    ? { verdict: 'encrypt', target, kind: BodyKind.action, body: action[1] ?? '' }
    : { verdict: 'encrypt', target, kind: BodyKind.message, body };
};

/** Wraps the text in the IRC codes for the user's chosen style */
export const applyFormatting = (text: string, formatting: FontFormatting): string => {
  let prefix = '';
  let suffix = '';

  if (formatting.bold) {
    prefix += IRC_FORMAT.BOLD;
    suffix = IRC_FORMAT.BOLD + suffix;
  }
  if (formatting.italic) {
    prefix += IRC_FORMAT.ITALIC;
    suffix = IRC_FORMAT.ITALIC + suffix;
  }
  if (formatting.underline) {
    prefix += IRC_FORMAT.UNDERLINE;
    suffix = IRC_FORMAT.UNDERLINE + suffix;
  }
  if (formatting.colorCode !== null) {
    const colorStr = formatting.colorCode.toString().padStart(2, '0');
    prefix += IRC_FORMAT.COLOR + colorStr;
    suffix = IRC_FORMAT.COLOR + suffix;
  }

  return prefix + text + suffix;
};
