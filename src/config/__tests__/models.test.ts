import {
  CALL_DURATION_MIN,
  CALL_WARNING_MIN,
  DEFAULT_VOICE,
  LIVE_MODEL,
  MIN_ANALYZABLE_CALL_SEC,
  TEXT_MODEL,
  TEXT_MODEL_FALLBACK,
} from '../models';

describe('models config', () => {
  it('has non-empty model ids without the "models/" prefix', () => {
    for (const id of [LIVE_MODEL, TEXT_MODEL, TEXT_MODEL_FALLBACK]) {
      expect(id.length).toBeGreaterThan(0);
      expect(id.startsWith('models/')).toBe(false);
    }
  });

  it('uses a different fallback than the primary text model', () => {
    expect(TEXT_MODEL_FALLBACK).not.toBe(TEXT_MODEL);
  });

  it('has a default voice', () => {
    expect(DEFAULT_VOICE.length).toBeGreaterThan(0);
  });

  it('warns before the call ends', () => {
    expect(CALL_WARNING_MIN).toBeGreaterThan(0);
    expect(CALL_WARNING_MIN).toBeLessThan(CALL_DURATION_MIN);
    expect(MIN_ANALYZABLE_CALL_SEC).toBeLessThan(CALL_DURATION_MIN * 60);
  });
});
