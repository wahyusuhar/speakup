import { LiveClient, type WebSocketLike } from '../LiveClient';
import { LiveError, type LiveClientEvent } from '../types';

const SECRET_KEY = 'TEST_KEY_should_never_leak_123456';

class FakeSocket implements WebSocketLike {
  readyState = 0;
  binaryType = 'blob';
  sent: unknown[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(msg: object | string) {
    this.onmessage?.({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) });
  }
  serverClose(code: number, reason: string) {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  let socket: FakeSocket | null = null;
  const client = new LiveClient({
    apiKey: SECRET_KEY,
    model: 'test-model',
    systemInstruction: 'sys',
    voiceName: 'Kore',
    connectTimeoutMs: 1000,
    createSocket: (url) => (socket = new FakeSocket(url)),
  });
  const events: LiveClientEvent[] = [];
  client.on((e) => events.push(e));
  const getSocket = () => {
    if (!socket) throw new Error('socket not created');
    return socket;
  };
  return { client, events, getSocket };
}

describe('LiveClient', () => {
  it('sends setup on open and resolves on setupComplete', async () => {
    const { client, getSocket } = setup();
    const connecting = client.connect();
    const s = getSocket();
    expect(s.url).toContain(`key=${SECRET_KEY}`);
    expect(s.binaryType).toBe('arraybuffer');

    s.open();
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0]).toMatchObject({ setup: { model: 'models/test-model' } });

    s.receive({ setupComplete: {} });
    await expect(connecting).resolves.toBeUndefined();
    expect(client.isReady).toBe(true);
  });

  it('only sends audio after setup completes', async () => {
    const { client, getSocket } = setup();
    const connecting = client.connect();
    const s = getSocket();
    s.open();
    client.sendAudio('AAAA');
    expect(s.sent).toHaveLength(1); // only setup

    s.receive({ setupComplete: {} });
    await connecting;
    client.sendAudio('AAAA');
    client.sendText('hello');
    expect(s.sent[1]).toEqual({ realtimeInput: { audio: { data: 'AAAA', mimeType: 'audio/pcm;rate=16000' } } });
    expect(s.sent[2]).toMatchObject({ clientContent: { turnComplete: true } });
  });

  it('emits parsed server events, including from ArrayBuffer frames', async () => {
    const { client, events, getSocket } = setup();
    const connecting = client.connect();
    const s = getSocket();
    s.open();
    s.receive({ setupComplete: {} });
    await connecting;

    const bytes = new TextEncoder().encode(JSON.stringify({ serverContent: { interrupted: true } }));
    s.onmessage?.({ data: bytes.buffer });
    s.receive({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AQI=' } }] }, turnComplete: true } });
    await flush();

    expect(events.map((e) => e.type)).toEqual(['setupComplete', 'interrupted', 'audio', 'turnComplete']);
  });

  it('rejects without leaking the key when closed before setup', async () => {
    const { client, events, getSocket } = setup();
    const connecting = client.connect();
    const s = getSocket();
    s.open();
    s.serverClose(1008, 'API key not valid');

    const err = await connecting.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LiveError);
    const le = err as LiveError;
    expect(le.code).toBe('closed_before_setup');
    expect(le.closeCode).toBe(1008);
    expect(le.closeReason).toBe('API key not valid');
    expect(`${le.message} ${le.stack ?? ''}`).not.toContain(SECRET_KEY);
    // No separate close event: the rejection is the single failure signal.
    expect(events).toEqual([]);
  });

  it('times out when setupComplete never arrives', async () => {
    jest.useFakeTimers();
    try {
      const { client, getSocket } = setup();
      const connecting = client.connect();
      getSocket().open();
      jest.advanceTimersByTime(1001);
      await expect(connecting).rejects.toMatchObject({ code: 'timeout' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('emits close when the server drops an active connection', async () => {
    const { client, events, getSocket } = setup();
    const connecting = client.connect();
    const s = getSocket();
    s.open();
    s.receive({ setupComplete: {} });
    await connecting;

    s.serverClose(1011, 'Internal error');
    expect(events.at(-1)).toEqual({ type: 'close', code: 1011, reason: 'Internal error' });
    expect(client.isReady).toBe(false);
  });

  it('emits an error event for malformed frames', async () => {
    const { client, events, getSocket } = setup();
    const connecting = client.connect();
    const s = getSocket();
    s.open();
    s.receive({ setupComplete: {} });
    await connecting;

    s.receive('not json');
    await flush();
    expect(events.at(-1)).toMatchObject({ type: 'error' });
  });
});
