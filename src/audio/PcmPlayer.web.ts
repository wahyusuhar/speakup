// Web playback: browser AudioContext; 24 kHz buffers scheduled back-to-back; flush() for barge-in.
import { PLAYBACK_RATE, base64ToInt16, int16ToFloat32 } from './pcm';
import { AudioError, type CreatePcmPlayer, type PcmPlayer, type PcmPlayerOptions } from './types';

/** Small jitter buffer added when playback (re)starts from silence. */
const START_LEAD_SEC = 0.05;

class WebPcmPlayer implements PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private playing = false;

  constructor(private readonly options: PcmPlayerOptions = {}) {}

  async start(): Promise<void> {
    if (this.ctx) return;
    if (typeof AudioContext === 'undefined') {
      throw new AudioError('not_supported', 'Web Audio is not available in this browser');
    }
    this.ctx = new AudioContext();
    await this.ctx.resume();
    this.nextStartTime = 0;
  }

  enqueue(base64Pcm24k: string): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const samples = int16ToFloat32(base64ToInt16(base64Pcm24k));
    if (samples.length === 0) return;

    const buffer = ctx.createBuffer(1, samples.length, PLAYBACK_RATE);
    buffer.getChannelData(0).set(samples);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = this.nextStartTime > now ? this.nextStartTime : now + START_LEAD_SEC;
    src.start(startAt);
    this.nextStartTime = startAt + buffer.duration;

    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.setPlaying(false);
    };
    this.setPlaying(true);
  }

  flush(): void {
    for (const src of this.sources) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // Already stopped.
      }
      src.disconnect();
    }
    this.sources.clear();
    this.nextStartTime = 0;
    this.setPlaying(false);
  }

  async close(): Promise<void> {
    this.flush();
    if (this.ctx) {
      await this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }

  private setPlaying(playing: boolean) {
    if (this.playing === playing) return;
    this.playing = playing;
    this.options.onPlayingChange?.(playing);
  }
}

export const createPcmPlayer: CreatePcmPlayer = (options) => new WebPcmPlayer(options);
