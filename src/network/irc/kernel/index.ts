import { DEBUG_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { addToBatch, BATCH_TYPES, getBatch, getMessageBatchId } from '@/network/irc/batch';
import { parseIrcRawMessage } from '@/network/irc/helpers';
import { IrcContext } from '@/network/irc/kernel/context';
import { handleConnect, handleDisconnected, handleError } from '@/network/irc/kernel/connection';
import { ircHandlers } from '@/network/irc/kernel/registry';
import { onUnhandledNumeric } from '@/network/irc/kernel/unhandled';
import { takeLabel } from '@/network/irc/labels';
import { onConnectionTornDown, resetInactivityTimeout } from '@/network/irc/network';
import { setAddMessage } from '@features/channels/store/channels';
import { clearIncomingState } from '@features/e2ee/incoming';
import { endAllSessions } from '@features/e2ee/session';
import { clearMonitorList } from '@features/monitor/store/monitor';
import { redactSensitiveIrc } from '@shared/lib/utils';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

export interface IrcEvent {
  type: string;
  line?: string;
}

// Self-initiated teardowns never reach handleDisconnected, so per-connection state is cleared here too
onConnectionTornDown(() => {
  endAllSessions();
  clearIncomingState();
  clearMonitorList();
});

export class Kernel {
  private readonly event: IrcEvent;
  private readonly eventLine: string;

  constructor(event: IrcEvent) {
    this.event = event;
    this.eventLine = event.line !== undefined ? event.line.trim() : '';
  }

  handle(): void {
    switch (this.event.type) {
      case 'connect':
        handleConnect();
        break;
      case 'close':
        handleDisconnected();
        break;
      case 'error':
        handleError(this.eventLine);
        break;
      case 'raw':
        if (this.event.line !== undefined) {
          this.handleRaw(this.event.line);
        }
        break;
      default:
        if (import.meta.env.DEV) { console.log(`unhandled kernel event: ${this.event.type} ${this.event.line ?? ''}`); }
    }
  }

  private readonly handleRaw = (event: string): void => {
    resetInactivityTimeout();
    const ctx = new IrcContext(parseIrcRawMessage(event), this.eventLine);

    if (import.meta.env.DEV) {
      setAddMessage({
        id: uuidv4(),
        message: `>> ${redactSensitiveIrc(this.eventLine)}`,
        target: DEBUG_CHANNEL,
        time: new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.serverFrom,
      });
    }

    const { tags, sender, command, line } = ctx;
    if (command !== 'BATCH') {
      const batchId = getMessageBatchId({ tags, sender, command, line: [...line] });
      const batch = batchId !== undefined ? getBatch(batchId) : undefined;
      if (batch?.type === BATCH_TYPES.LABELED_RESPONSE) {
        // Replies to one command, grouped only to carry its label: handled as they arrive
        ctx.request = batch.request;
      } else if (batchId !== undefined) {
        addToBatch(batchId, { tags, sender, command, line: [...line] });
        return;
      } else if (tags.label !== undefined) {
        ctx.request = takeLabel(tags.label);
      }
    }

    const handler = ircHandlers.get(command);
    if (handler) {
      handler(ctx);
    } else if (/^\d{3}$/.test(command)) {
      onUnhandledNumeric(ctx);
    } else if (import.meta.env.DEV) {
      console.log(`unknown irc event: ${JSON.stringify(event)}`);
    }
  };
}
