import { MAX_RESPONSE_MS, ResponseLatencyTracker, VOICE_RMS_THRESHOLD } from '../latency';

const LOUD = VOICE_RMS_THRESHOLD * 5;
const QUIET = VOICE_RMS_THRESHOLD / 4;

describe('ResponseLatencyTracker', () => {
  it('measures from the last voiced mic chunk to the first tutor chunk', () => {
    const t = new ResponseLatencyTracker();
    t.onMicLevel(1000, LOUD);
    t.onMicLevel(1100, LOUD);
    t.onMicLevel(1200, QUIET);
    t.onMicLevel(1300, QUIET);
    expect(t.onTutorAudio(2000)).toBe(900);
    // Later chunks of the same reply are not new measurements.
    expect(t.onTutorAudio(2100)).toBeNull();
  });

  it('does not measure the opening greeting or a reply without student speech', () => {
    const t = new ResponseLatencyTracker();
    t.onMicLevel(100, QUIET);
    expect(t.onTutorAudio(500)).toBeNull();
    t.onTutorSilent();
    expect(t.onTutorAudio(900)).toBeNull();
  });

  it('ignores mic levels while the tutor is audible (echo) and measures after barge-in', () => {
    const t = new ResponseLatencyTracker();
    t.onMicLevel(0, LOUD);
    expect(t.onTutorAudio(800)).toBe(800);
    t.onMicLevel(1500, LOUD); // echo or barge-in while the tutor talks
    t.onTutorSilent(); // interrupted / finished
    expect(t.onTutorAudio(1700)).toBeNull();
    t.onTutorSilent();
    t.onMicLevel(3000, LOUD);
    expect(t.onTutorAudio(4200)).toBe(1200);
  });

  it('drops implausibly long gaps', () => {
    const t = new ResponseLatencyTracker();
    t.onMicLevel(0, LOUD);
    expect(t.onTutorAudio(MAX_RESPONSE_MS + 1)).toBeNull();
  });
});
