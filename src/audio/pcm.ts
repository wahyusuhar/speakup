// Pure PCM helpers shared by web and native audio code. No platform APIs here.
// Wire formats (Gemini Live API docs):
//   input  -> 16-bit PCM, little-endian, 16 kHz, mono
//   output <- 16-bit PCM, little-endian, 24 kHz, mono
import { Buffer } from 'buffer';

export const MIC_TARGET_RATE = 16000;
export const PLAYBACK_RATE = 24000;
/** ~100 ms of audio at MIC_TARGET_RATE. */
export const MIC_CHUNK_SAMPLES = 1600;
export const MIC_MIME_TYPE = `audio/pcm;rate=${MIC_TARGET_RATE}`;

/** Float32 [-1, 1] -> Int16, clamping out-of-range values. */
export function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

/** Int16 -> Float32 [-1, 1). */
export function int16ToFloat32(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = (input[i] ?? 0) / 0x8000;
  }
  return out;
}

/** Int16 samples -> base64 of little-endian bytes (independent of host endianness). */
export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(i * 2, samples[i] ?? 0, true);
  }
  return Buffer.from(bytes).toString('base64');
}

/** base64 of little-endian 16-bit PCM -> Int16 samples. A trailing odd byte is ignored. */
export function base64ToInt16(b64: string): Int16Array {
  const buf = Buffer.from(b64, 'base64');
  const count = Math.floor(buf.length / 2);
  const out = new Int16Array(count);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(i * 2, true);
  }
  return out;
}

/**
 * Linear-interpolation resampler that keeps state between chunks, so a stream
 * split into arbitrary chunks resamples to the same output as one big buffer.
 */
export class StreamingResampler {
  private readonly step: number;
  /** Read position relative to the start of the next input chunk; may be in [-1, 0). */
  private pos = 0;
  /** Last sample of the previous chunk (index -1). */
  private prev = 0;

  constructor(
    readonly fromRate: number,
    readonly toRate: number,
  ) {
    if (fromRate <= 0 || toRate <= 0) throw new Error('Sample rates must be positive');
    this.step = fromRate / toRate;
  }

  process(input: Float32Array): Float32Array {
    if (input.length === 0) return new Float32Array(0);
    if (this.fromRate === this.toRate) return input.slice();

    const out: number[] = [];
    const len = input.length;
    // Need samples at floor(pos) and floor(pos) + 1, both <= len - 1.
    while (Math.floor(this.pos) + 1 <= len - 1) {
      const i0 = Math.floor(this.pos);
      const frac = this.pos - i0;
      const s0 = i0 < 0 ? this.prev : (input[i0] ?? 0);
      const s1 = input[i0 + 1] ?? 0;
      out.push(s0 + (s1 - s0) * frac);
      this.pos += this.step;
    }
    this.pos -= len;
    this.prev = input[len - 1] ?? 0;
    return Float32Array.from(out);
  }

  reset(): void {
    this.pos = 0;
    this.prev = 0;
  }
}

/** Groups a stream of samples into fixed-size chunks. */
export class SampleChunker {
  private buf: Int16Array;
  private filled = 0;

  constructor(readonly size: number) {
    if (size <= 0) throw new Error('Chunk size must be positive');
    this.buf = new Int16Array(size);
  }

  /** Adds samples and returns every chunk that became full. */
  push(samples: Int16Array): Int16Array[] {
    const chunks: Int16Array[] = [];
    let offset = 0;
    while (offset < samples.length) {
      const take = Math.min(this.size - this.filled, samples.length - offset);
      this.buf.set(samples.subarray(offset, offset + take), this.filled);
      this.filled += take;
      offset += take;
      if (this.filled === this.size) {
        chunks.push(this.buf);
        this.buf = new Int16Array(this.size);
        this.filled = 0;
      }
    }
    return chunks;
  }

  /** Returns the partially filled remainder (if any) and empties the buffer. */
  flush(): Int16Array | null {
    if (this.filled === 0) return null;
    const rest = this.buf.slice(0, this.filled);
    this.filled = 0;
    return rest;
  }

  reset(): void {
    this.filled = 0;
  }
}
