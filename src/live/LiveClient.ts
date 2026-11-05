// Gemini Live WebSocket client. Platform-independent: uses the global WebSocket
// (browser and React Native). The URL contains the API key, so it is never logged.
import { Buffer } from 'buffer';

import {
  buildAudioMessage,
  buildAudioStreamEndMessage,
  buildLiveUrl,
  buildSetupMessage,
  buildUserTextTurn,
  parseServerMessage,
  type SetupOptions,
} from './messages';
import { LiveError, type LiveClientEvent } from './types';

/** Minimal WebSocket surface used here (matches browser and React Native). */
export interface WebSocketLike {
  readonly readyState: number;
  binaryType: string;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
}

export type LiveClientOptions = SetupOptions & {
  apiKey: string;
  /** Milliseconds to wait for setupComplete. */
  connectTimeoutMs?: number;
  /** Injectable for tests. */
  createSocket?: (url: string) => WebSocketLike;
};

const OPEN = 1;

type Listener = (event: LiveClientEvent) => void;

export class LiveClient {
  private socket: WebSocketLike | null = null;
  private ready = false;
  private closedByClient = false;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly options: LiveClientOptions) {}

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isReady(): boolean {
    return this.ready;
  }

  /** Opens the socket, sends `setup`, and resolves once `setupComplete` arrives. */
  connect(): Promise<void> {
    if (this.socket) return Promise.reject(new LiveError('protocol', 'Already connected'));
    const { apiKey, connectTimeoutMs = 15000, createSocket, ...setup } = this.options;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (err: LiveError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      };
      const timer = setTimeout(() => {
        fail(new LiveError('timeout', 'Timed out waiting for setupComplete'));
        this.closeSocket();
      }, connectTimeoutMs);

      const factory = createSocket ?? ((url: string) => new WebSocket(url) as unknown as WebSocketLike);
      let socket: WebSocketLike;
      try {
        socket = factory(buildLiveUrl(apiKey));
      } catch {
        fail(new LiveError('socket_error', 'Could not open WebSocket'));
        return;
      }
      this.socket = socket;
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        socket.send(JSON.stringify(buildSetupMessage(setup)));
      };

      socket.onmessage = (ev) => {
        void this.decode(ev.data).then((raw) => {
          if (raw === null) return;
          let events;
          try {
            events = parseServerMessage(raw);
          } catch (e) {
            this.emit({ type: 'error', message: e instanceof Error ? e.message : 'protocol error' });
            return;
          }
          for (const event of events) {
            if (event.type === 'setupComplete' && !this.ready) {
              this.ready = true;
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve();
              }
            }
            this.emit(event);
          }
        });
      };

      socket.onerror = () => {
        // Browsers expose no details here; the close event carries code/reason.
        if (settled) this.emit({ type: 'error', message: 'WebSocket error' });
      };

      socket.onclose = (ev) => {
        const wasReady = this.ready;
        this.ready = false;
        this.socket = null;
        if (wasReady) {
          this.emit({ type: 'close', code: ev.code, reason: ev.reason });
        } else {
          // Before setup, failures are reported only through the connect() rejection.
          fail(new LiveError('closed_before_setup', 'Connection closed before setup completed', ev.code, ev.reason));
        }
      };
    });
  }

  sendAudio(base64Pcm16k: string): void {
    this.send(buildAudioMessage(base64Pcm16k));
  }

  sendAudioStreamEnd(): void {
    this.send(buildAudioStreamEndMessage());
  }

  sendText(text: string): void {
    this.send(buildUserTextTurn(text));
  }

  close(): void {
    this.closedByClient = true;
    this.closeSocket();
  }

  private closeSocket() {
    const s = this.socket;
    if (s) {
      try {
        s.close(1000, 'client closed');
      } catch {
        // ignore
      }
    }
  }

  private send(message: object) {
    const s = this.socket;
    if (!s || !this.ready || s.readyState !== OPEN) return;
    s.send(JSON.stringify(message));
  }

  private emit(event: LiveClientEvent) {
    for (const l of this.listeners) l(event);
  }

  /** Server frames may arrive as text, ArrayBuffer, or Blob depending on platform. */
  private async decode(data: unknown): Promise<string | null> {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
    if (ArrayBuffer.isView(data)) {
      return Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).toString('utf8');
    }
    if (data && typeof (data as { text?: unknown }).text === 'function') {
      return (data as { text: () => Promise<string> }).text();
    }
    return null;
  }
}
