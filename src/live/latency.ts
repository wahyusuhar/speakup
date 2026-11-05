// Measures the response delay the student actually experiences: from the end of the
// student's speech (last mic chunk above the voice threshold) to the first audio chunk
// of the tutor's reply arriving. Pure (timestamps are passed in) so it can be unit tested.
//
// Limits: mic chunks are ~100 ms, so the end of speech is known to about ±100 ms, and
// the time is measured at arrival, before the player's small start-up buffer.

/** RMS above this counts as the student speaking (after browser noise suppression). */
export const VOICE_RMS_THRESHOLD = 0.02;

/** Longer gaps are not a reply to what the student said (e.g. a time-check turn). */
export const MAX_RESPONSE_MS = 10_000;

export class ResponseLatencyTracker {
  private lastVoiceAt: number | null = null;
  private tutorAudible = false;

  /** Mic level for one chunk. Ignored while the tutor is audible (echo, barge-in). */
  onMicLevel(now: number, rms: number): void {
    if (this.tutorAudible) return;
    if (rms >= VOICE_RMS_THRESHOLD) this.lastVoiceAt = now;
  }

  /** A tutor audio chunk arrived. Returns the delay in ms for the first chunk of a reply, else null. */
  onTutorAudio(now: number): number | null {
    if (this.tutorAudible) return null;
    this.tutorAudible = true;
    const voiceAt = this.lastVoiceAt;
    this.lastVoiceAt = null;
    if (voiceAt === null) return null;
    const delay = now - voiceAt;
    return delay >= 0 && delay <= MAX_RESPONSE_MS ? delay : null;
  }

  /** The tutor's audio stopped (finished playing or was interrupted). */
  onTutorSilent(): void {
    this.tutorAudible = false;
  }
}
