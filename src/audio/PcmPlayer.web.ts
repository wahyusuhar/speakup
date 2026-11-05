// Web playback: browser AudioContext, 24 kHz buffers scheduled back-to-back; flush() for barge-in.
// TODO(Fase 2): implement.
import type { CreatePcmPlayer, PcmPlayer } from './types';

class WebPcmPlayer implements PcmPlayer {
  enqueue(): void {
    throw new Error('WebPcmPlayer is not implemented yet (Fase 2)');
  }

  flush(): void {}

  async close(): Promise<void> {}
}

export const createPcmPlayer: CreatePcmPlayer = () => new WebPcmPlayer();
