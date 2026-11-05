/** 75 -> "01:15". */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 850 -> "0,9 dtk" (Indonesian decimal comma). */
export function formatDelay(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} dtk`;
}

/** Initial for an avatar: first letter of the last word ("Mas Wahyu" -> "W"). */
export function initialOf(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1]?.[0] ?? '?').toUpperCase();
}
