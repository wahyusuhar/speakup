import { Buffer } from 'buffer';

import {
  MIC_CHUNK_SAMPLES,
  MIC_MIME_TYPE,
  SampleChunker,
  StreamingResampler,
  base64ToInt16,
  float32ToInt16,
  int16ToBase64,
  int16ToFloat32,
  rmsInt16,
} from '../pcm';

describe('rmsInt16', () => {
  it('is 0 for silence and empty input', () => {
    expect(rmsInt16(new Int16Array(0))).toBe(0);
    expect(rmsInt16(new Int16Array(100))).toBe(0);
  });

  it('measures a constant and a square wave', () => {
    expect(rmsInt16(new Int16Array(10).fill(16384))).toBeCloseTo(0.5, 5);
    const square = Int16Array.from({ length: 100 }, (_, i) => (i % 2 ? 8192 : -8192));
    expect(rmsInt16(square)).toBeCloseTo(0.25, 5);
  });
});

describe('float32ToInt16 / int16ToFloat32', () => {
  it('maps the full range and clamps out-of-range values', () => {
    const out = float32ToInt16(Float32Array.from([0, 1, -1, 0.5, 2, -2]));
    expect(Array.from(out)).toEqual([0, 32767, -32768, 16384, 32767, -32768]);
  });

  it('round-trips within one quantisation step', () => {
    const input = Float32Array.from([0, 0.25, -0.25, 0.9, -0.9]);
    const back = int16ToFloat32(float32ToInt16(input));
    back.forEach((v, i) => expect(Math.abs(v - (input[i] ?? 0))).toBeLessThan(1 / 16384));
  });
});

describe('base64 helpers', () => {
  it('encodes little-endian bytes', () => {
    // 0x0102 -> bytes 02 01 ; -2 (0xFFFE) -> bytes FE FF
    const b64 = int16ToBase64(Int16Array.from([0x0102, -2]));
    expect(Array.from(Buffer.from(b64, 'base64'))).toEqual([0x02, 0x01, 0xfe, 0xff]);
  });

  it('round-trips samples', () => {
    const samples = Int16Array.from([0, 1, -1, 32767, -32768, 1234, -4321]);
    expect(Array.from(base64ToInt16(int16ToBase64(samples)))).toEqual(Array.from(samples));
  });

  it('ignores a trailing odd byte', () => {
    const b64 = Buffer.from([0x01, 0x00, 0x7f]).toString('base64');
    expect(Array.from(base64ToInt16(b64))).toEqual([1]);
  });

  it('returns an empty array for empty input', () => {
    expect(base64ToInt16('').length).toBe(0);
    expect(int16ToBase64(new Int16Array(0))).toBe('');
  });
});

describe('StreamingResampler', () => {
  const ramp = (n: number) => Float32Array.from({ length: n }, (_, i) => i / n);

  it('passes audio through unchanged when rates match', () => {
    const r = new StreamingResampler(16000, 16000);
    const input = ramp(10);
    expect(Array.from(r.process(input))).toEqual(Array.from(input));
  });

  it('downsamples 48 kHz to 16 kHz with the expected length', () => {
    const r = new StreamingResampler(48000, 16000);
    const out = r.process(ramp(4800));
    expect(Math.abs(out.length - 1600)).toBeLessThanOrEqual(1);
  });

  it('interpolates linearly', () => {
    const r = new StreamingResampler(2, 4); // upsample x2
    const out = r.process(Float32Array.from([0, 1, 2]));
    expect(Array.from(out)).toEqual([0, 0.5, 1, 1.5]);
  });

  it('produces the same output when the stream is split into chunks', () => {
    const input = Float32Array.from({ length: 4410 }, (_, i) => Math.sin(i / 7));
    const whole = new StreamingResampler(44100, 16000).process(input);

    const chunked = new StreamingResampler(44100, 16000);
    const parts: number[] = [];
    let offset = 0;
    for (const size of [128, 1000, 7, 2048, 1227]) {
      parts.push(...chunked.process(input.subarray(offset, offset + size)));
      offset += size;
    }
    expect(offset).toBe(input.length);
    expect(parts.length).toBe(whole.length);
    parts.forEach((v, i) => expect(v).toBeCloseTo(whole[i] ?? NaN, 6));
  });

  it('rejects non-positive rates', () => {
    expect(() => new StreamingResampler(0, 16000)).toThrow();
  });
});

describe('SampleChunker', () => {
  it('emits fixed-size chunks and keeps the remainder', () => {
    const c = new SampleChunker(4);
    expect(c.push(Int16Array.from([1, 2, 3]))).toEqual([]);
    const chunks = c.push(Int16Array.from([4, 5, 6, 7, 8, 9]));
    expect(chunks.map((x) => Array.from(x))).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    expect(Array.from(c.flush() ?? [])).toEqual([9]);
    expect(c.flush()).toBeNull();
  });

  it('does not reuse buffers of emitted chunks', () => {
    const c = new SampleChunker(2);
    const [a] = c.push(Int16Array.from([1, 2]));
    c.push(Int16Array.from([3, 4]));
    expect(Array.from(a ?? [])).toEqual([1, 2]);
  });
});

describe('constants', () => {
  it('uses 100 ms chunks at 16 kHz', () => {
    expect(MIC_CHUNK_SAMPLES).toBe(1600);
    expect(MIC_MIME_TYPE).toBe('audio/pcm;rate=16000');
  });
});
