// Web mic capture: getUserMedia + AudioWorklet -> resample to 16 kHz -> Int16 -> base64 chunks (~100 ms).
import {
  MIC_CHUNK_SAMPLES,
  MIC_TARGET_RATE,
  SampleChunker,
  StreamingResampler,
  float32ToInt16,
  int16ToBase64,
} from './pcm';
import { AudioError, type CreateMicStreamer, type MicChunkHandler, type MicStreamer } from './types';

const PROCESSOR_NAME = 'speakup-mic-capture';

// Runs on the audio rendering thread. Batches 128-frame render quanta into
// ~2048-sample blocks to limit message traffic to the main thread.
const WORKLET_SOURCE = `
class SpeakUpMicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.buf.slice(0));
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('${PROCESSOR_NAME}', SpeakUpMicCapture);
`;

function toAudioError(e: unknown): AudioError {
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new AudioError('permission_denied', 'Microphone permission denied');
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new AudioError('no_device', 'No microphone found');
  }
  return new AudioError('unknown', `Microphone error: ${name || 'unknown'}`);
}

class WebMicStreamer implements MicStreamer {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private workletUrl: string | null = null;
  private active = false;

  async start(onChunk: MicChunkHandler): Promise<void> {
    if (this.active) throw new AudioError('unknown', 'MicStreamer already started');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new AudioError('not_supported', 'getUserMedia is not available (needs HTTPS or localhost)');
    }
    if (typeof AudioWorkletNode === 'undefined') {
      throw new AudioError('not_supported', 'AudioWorklet is not available in this browser');
    }
    this.active = true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      this.active = false;
      throw toAudioError(e);
    }

    try {
      const { ctx, source } = await this.openContext(this.stream);
      this.ctx = ctx;

      const resampler = new StreamingResampler(ctx.sampleRate, MIC_TARGET_RATE);
      const chunker = new SampleChunker(MIC_CHUNK_SAMPLES);

      const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
      node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        if (!this.active) return;
        const pcm = float32ToInt16(resampler.process(ev.data));
        for (const chunk of chunker.push(pcm)) {
          onChunk(int16ToBase64(chunk));
        }
      };

      // Keep the node in the rendering graph without making any sound.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node);
      node.connect(mute);
      mute.connect(ctx.destination);
      this.node = node;
    } catch (e) {
      await this.stop();
      throw e instanceof AudioError ? e : new AudioError('unknown', 'Failed to start audio capture');
    }
  }

  /**
   * Prefers a 16 kHz context so the browser does high-quality resampling.
   * Some browsers refuse to connect a mic stream to a context with a different
   * rate; then fall back to the device rate and resample in JS.
   */
  private async openContext(stream: MediaStream) {
    try {
      const ctx = new AudioContext({ sampleRate: MIC_TARGET_RATE });
      try {
        await this.prepare(ctx);
        const source = ctx.createMediaStreamSource(stream);
        return { ctx, source };
      } catch {
        await ctx.close().catch(() => undefined);
      }
    } catch {
      // Constructor rejected the sample rate; use the default below.
    }
    const ctx = new AudioContext();
    await this.prepare(ctx);
    return { ctx, source: ctx.createMediaStreamSource(stream) };
  }

  private async prepare(ctx: AudioContext) {
    await ctx.resume();
    if (!this.workletUrl) {
      this.workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
    }
    await ctx.audioWorklet.addModule(this.workletUrl);
  }

  async stop(): Promise<void> {
    this.active = false;
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.disconnect();
      this.node = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx) {
      await this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }
  }
}

export const createMicStreamer: CreateMicStreamer = () => new WebMicStreamer();
