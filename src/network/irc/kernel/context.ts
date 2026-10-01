import * as Sentry from '@sentry/react';
import { redactSensitiveIrc } from '@shared/lib/utils';
import { type ParsedIrcRawMessage } from '@shared/types';

/** One parsed IRC line; handlers consume `line` as they read parameters. */
export class IrcContext {
  tags: Record<string, string>;
  sender: string;
  command: string;
  line: string[];
  readonly eventLine: string;

  constructor(message: ParsedIrcRawMessage, eventLine: string) {
    this.eventLine = eventLine;
    this.tags = message.tags;
    this.sender = message.sender;
    this.command = message.command;
    this.line = [...message.line];
  }

  stripColon(value: string): string {
    return value.startsWith(':') ? value.substring(1) : value;
  }

  /** Join remaining line tokens into a trailing parameter, stripping the leading ':' */
  trailing(): string {
    return this.stripColon(this.line.join(' '));
  }

  /** Join remaining line tokens into a trailing parameter, returning undefined if empty */
  trailingOptional(): string | undefined {
    return this.line.length > 0 ? this.trailing() : undefined;
  }

  logParseError(handler: (...args: never[]) => unknown, variable: string): void {
    const error = new Error(`Kernel error - cannot parse ${variable} at ${handler.name}`);
    Sentry.captureException(error, {
      extra: {
        eventLine: redactSensitiveIrc(this.eventLine),
        command: this.command,
        sender: this.sender,
        tags: this.tags,
      },
    });
    console.error(error.message, { line: redactSensitiveIrc(this.eventLine) });
  }
}

export type IrcHandler = (ctx: IrcContext) => void;

/** Command or numeric → handler, as each module registers them. */
export type IrcHandlers = Record<string, IrcHandler>;
