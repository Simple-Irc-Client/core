import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { PASSWORD_FILE } from './global-setup';

/**
 * Pattern to match RPL_WELCOME (001) from a server
 *
 * - Optional IRCv3 message tags (@key=value;... ) at the start
 * - Server prefix starting with :
 * - Source must not contain ! or @ (those indicate a user hostmask)
 * - Command must be exactly 001
 */
const RPL_WELCOME_PATTERN = /^(@\S+ )?:[^\s!@]+ 001 /;

/** IRC line terminator */
const IRC_LINE_ENDING = '\r\n';

/** Maximum receive buffer size before dropping the connection (2MB) */
const MAX_RECEIVE_BUFFER_SIZE = 2 * 1024 * 1024;

/** Interval for sending PING keepalive messages (30 seconds) */
const PING_INTERVAL_MS = 30000;

/** Timeout for TCP/TLS connection establishment (30 seconds) */
const CONNECTION_TIMEOUT_MS = 30000;

/** Default timeout for receiving server response after sending PING (120 seconds) */
const DEFAULT_PONG_TIMEOUT_MS = 120000;

/** Timeout for CAP LS response before retrying (10 seconds) */
const CAP_RESPONSE_TIMEOUT_MS = 10000;

/** Maximum number of CAP LS retries */
const CAP_MAX_RETRIES = 2;

/**
 * Matches a CAP LS line from the server (with or without server prefix).
 * Captures an optional continuation marker (* after LS) in group 1.
 * Formats:
 *   CAP * LS * :caps...          (no server prefix, continuation)
 *   CAP * LS :caps...            (no server prefix, final)
 *   :server CAP nick LS * :caps  (with server prefix, continuation)
 *   :server CAP nick LS :caps    (with server prefix, final)
 */
const CAP_LS_PATTERN = /(?:^|\s)CAP \S+ LS(\s\*)?/;

/** Strip CR/LF to prevent IRC line injection */
const stripCRLF = (input: string): string => input.replace(/[\r\n]/g, '');

interface RawIrcClientOptions {
  host: string;
  port: number;
  nick: string;
  password?: string;
  username: string;
  gecos: string;
  encoding?: BufferEncoding;
  tls?: boolean;
  pongTimeout?: number;
}

/**
 * Raw IRC client (TCP connection with CAP negotiation and auto-registration).
 * Not exported — use IrcClient for the async test helper API.
 */
class RawIrcClient extends EventEmitter {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private receiveBuffer = Buffer.alloc(0);
  private characterEncoding: BufferEncoding = 'utf8';
  private pingIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pongTimeoutMs = DEFAULT_PONG_TIMEOUT_MS;
  private capResponseTimer: ReturnType<typeof setTimeout> | null = null;
  private capRetryCount = 0;
  private capResponseReceived = false;
  private capEndSent = false;

  get connected(): boolean {
    return this.socket?.writable ?? false;
  }

  connect(options: RawIrcClientOptions): void {
    this.destroy();

    this.characterEncoding = options.encoding ?? 'utf8';
    this.receiveBuffer = Buffer.alloc(0);
    this.pongTimeoutMs = (options.pongTimeout ?? 120) * 1000;

    const socket = options.tls
      ? tls.connect({ host: options.host, port: options.port, rejectUnauthorized: true })
      : net.connect({ host: options.host, port: options.port });

    this.socket = socket;

    socket.setTimeout(CONNECTION_TIMEOUT_MS);
    socket.once('timeout', () => socket.destroy(new Error('Connection timed out')));
    socket.once('connect', () => this.handleSocketConnected(options));
    socket.on('data', (data: Buffer) => this.handleIncomingData(data));
    socket.on('close', () => this.handleSocketClosed());
    socket.on('error', (error: Error) => this.emit('error', error));
  }

  private handleSocketConnected(options: RawIrcClientOptions): void {
    this.socket?.setTimeout(0);
    this.emit('socket connected');
    this.capRetryCount = 0;
    this.capResponseReceived = false;
    this.capEndSent = false;
    this.send('CAP LS 302');
    this.startCapResponseTimer();
    if (options.password) {
      this.send(`PASS ${stripCRLF(options.password)}`);
    }
    this.send(`NICK ${stripCRLF(options.nick)}`);
    this.send(`USER ${stripCRLF(options.username)} 0 * :${stripCRLF(options.gecos)}`);
    this.startPingTimer();
  }

  private startCapResponseTimer(): void {
    this.clearCapResponseTimer();
    this.capResponseTimer = setTimeout(() => {
      if (this.capResponseReceived) return;
      if (this.capRetryCount < CAP_MAX_RETRIES) {
        this.capRetryCount++;
        this.send('CAP LS 302');
        this.startCapResponseTimer();
      }
    }, CAP_RESPONSE_TIMEOUT_MS);
  }

  private clearCapResponseTimer(): void {
    if (this.capResponseTimer) {
      clearTimeout(this.capResponseTimer);
      this.capResponseTimer = null;
    }
  }

  private handleIncomingData(data: Buffer): void {
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);

    let lineEndIndex: number;
    while ((lineEndIndex = this.receiveBuffer.indexOf(IRC_LINE_ENDING)) !== -1) {
      const line = this.receiveBuffer.subarray(0, lineEndIndex).toString(this.characterEncoding);
      this.receiveBuffer = this.receiveBuffer.subarray(lineEndIndex + 2);
      if (line.length > 0) this.handleIrcLine(line);
    }

    if (this.receiveBuffer.length > MAX_RECEIVE_BUFFER_SIZE) {
      this.socket?.destroy(new Error('Receive buffer overflow'));
    }
  }

  private handleIrcLine(line: string): void {
    this.clearPongTimeout();
    this.emit('raw', line, true);

    if (line.startsWith('PING ')) {
      this.send(`PONG ${line.slice(5)}`);
      return;
    }

    const capLsMatch = CAP_LS_PATTERN.exec(line);
    if (capLsMatch) {
      if (!this.capResponseReceived) {
        this.capResponseReceived = true;
        this.clearCapResponseTimer();
      }
      const isContinuation = capLsMatch[1] !== undefined;
      if (!isContinuation && !this.capEndSent) {
        this.capEndSent = true;
        this.send('CAP END');
      }
      return;
    }

    if (RPL_WELCOME_PATTERN.test(line)) {
      this.emit('connected');
    }
  }

  send(line: string): void {
    if (this.socket?.writable) {
      this.socket.write(`${stripCRLF(line)}${IRC_LINE_ENDING}`);
      this.emit('raw', line, false);
    }
  }

  private handleSocketClosed(): void {
    this.stopPingTimer();
    this.clearCapResponseTimer();
    this.emit('close');
  }

  private startPingTimer(): void {
    this.pingIntervalTimer = setInterval(() => {
      this.send(`PING :${Date.now()}`);
      this.clearPongTimeout();
      this.pongTimeoutTimer = setTimeout(() => {
        this.socket?.destroy(new Error('PONG timeout: server unresponsive'));
      }, this.pongTimeoutMs);
    }, PING_INTERVAL_MS);
  }

  private clearPongTimeout(): void {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private stopPingTimer(): void {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
    this.clearPongTimeout();
  }

  quit(message?: string): void {
    if (this.socket?.writable) {
      this.send(message ? `QUIT :${message}` : 'QUIT');
      this.socket.end();
    }
    this.stopPingTimer();
    this.clearCapResponseTimer();
  }

  destroy(): void {
    this.stopPingTimer();
    this.clearCapResponseTimer();
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}

/**
 * Async test helper wrapping RawIrcClient with promise-based connect/join/setTopic.
 */
export class IrcClient {
  private readonly client: RawIrcClient;
  readonly nick: string;
  private readonly password?: string;

  constructor(nick: string, password?: string) {
    this.nick = nick;
    this.password = password;
    this.client = new RawIrcClient();
  }

  async connect(host = '127.0.0.1', port = 6667): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('connected', resolve);
      this.client.once('error', reject);
      this.client.connect({ host, port, nick: this.nick, password: this.password, username: this.nick, gecos: this.nick });
    });
  }

  send(line: string): void {
    this.client.send(line);
  }

  async join(channel: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out joining ${channel}`)), 10_000);
      this.client.on('raw', function handler(this: IrcClient, line: string) {
        if (line.includes('JOIN') && line.toLowerCase().includes(channel.toLowerCase())) {
          clearTimeout(timer);
          this.client.off('raw', handler);
          resolve();
        }
      }.bind(this));
      this.client.send(`JOIN ${channel}`);
    });
  }

  async setTopic(channel: string, topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out setting topic on ${channel}`)), 10_000);
      this.client.on('raw', function handler(this: IrcClient, line: string) {
        if ((line.includes('TOPIC') || line.includes('332')) && line.toLowerCase().includes(channel.toLowerCase())) {
          clearTimeout(timer);
          this.client.off('raw', handler);
          resolve();
        }
      }.bind(this));
      this.client.send(`TOPIC ${channel} :${topic}`);
    });
  }

  sendMessage(target: string, message: string): void {
    this.client.send(`PRIVMSG ${target} :${message}`);
  }

  sendAction(target: string, text: string): void {
    this.client.send(`PRIVMSG ${target} :\x01ACTION ${text}\x01`);
  }

  sendNotice(target: string, text: string): void {
    this.client.send(`NOTICE ${target} :${text}`);
  }

  async changeNick(newNick: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out changing nick to ${newNick}`)), 10_000);
      this.client.on('raw', function handler(this: IrcClient, line: string) {
        if (line.includes('NICK') && line.toLowerCase().includes(newNick.toLowerCase())) {
          clearTimeout(timer);
          this.client.off('raw', handler);
          resolve();
        }
      }.bind(this));
      this.client.send(`NICK ${newNick}`);
    });
  }

  async part(channel: string, reason?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out parting ${channel}`)), 10_000);
      this.client.on('raw', function handler(this: IrcClient, line: string) {
        if (line.includes('PART') && line.toLowerCase().includes(channel.toLowerCase())) {
          clearTimeout(timer);
          this.client.off('raw', handler);
          resolve();
        }
      }.bind(this));
      this.client.send(reason ? `PART ${channel} :${reason}` : `PART ${channel}`);
    });
  }

  kick(channel: string, nick: string, reason: string): void {
    this.client.send(`KICK ${channel} ${nick} :${reason}`);
  }

  setMode(channel: string, mode: string): void {
    this.client.send(`MODE ${channel} ${mode}`);
  }

  disconnect(): void {
    this.client.quit('bye');
  }
}

export const createIrcClient = async (nick: string, host = '127.0.0.1', port = 6667): Promise<IrcClient> => {
  const password = readFileSync(PASSWORD_FILE, 'utf8');
  const client = new IrcClient(nick, password);
  await client.connect(host, port);
  return client;
};
