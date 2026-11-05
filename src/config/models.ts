// Single source of truth for model names and call limits.
// Never hardcode a model name anywhere else in the codebase.
//
// Verified against official docs on 2026-11-05:
//   https://aistudio.google.com/docs/pricing  (all models below: "Free of charge" in Free Tier)
//   https://aistudio.google.com/docs/live-api
//   https://aistudio.google.com/docs/models
// Re-check these pages before changing any value; Live API is in preview.

/** Live (speech-to-speech) model used for calls. */
export const LIVE_MODEL = 'gemini-3.8-live';

/** Text model for session analysis, placement, and curriculum planning. */
export const TEXT_MODEL = 'gemini-3.8-flash';

/** Used once when TEXT_MODEL is rejected for quota (HTTP 429). */
export const TEXT_MODEL_FALLBACK = 'gemini-3.5-flash-lite';

/** Default prebuilt voice for the tutor (list: https://aistudio.google.com/docs/speech-generation). */
export const DEFAULT_VOICE = 'Kore';

/** Default call length; the call ends automatically after this. */
export const CALL_DURATION_MIN = 15;

/** Show the "call is ending soon" warning at this minute. */
export const CALL_WARNING_MIN = 13;

/** Calls shorter than this are not analyzed (ARCHITECTURE.md §10). */
export const MIN_ANALYZABLE_CALL_SEC = 30;
