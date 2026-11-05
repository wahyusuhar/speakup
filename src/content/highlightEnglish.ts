// Marks the English lesson items inside a tutor transcript so the UI can color them.
// Live transcripts carry no language markup, so we match the items of the lesson in use.
// Matching ignores case, punctuation and extra whitespace. A "..." slot in an item matches
// 1–3 words in the middle of an item and nothing at the start or end.

export type TextSegment = { text: string; english: boolean };

type Token = { norm: string; start: number; end: number };

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const SLOT = '\u0000slot';
const MAX_SLOT_WORDS = 3;

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/’/g, "'");
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD)) {
    const start = m.index ?? 0;
    out.push({ norm: normalizeWord(m[0]), start, end: start + m[0].length });
  }
  return out;
}

/** Turns an item like "I am ... years old." into ["i", "am", SLOT, "years", "old"]. */
export function phrasePattern(item: string): string[] {
  const pieces = item.split(/\.{3}|…/);
  const pattern: string[] = [];
  pieces.forEach((piece, i) => {
    if (i > 0) pattern.push(SLOT);
    for (const t of tokenize(piece)) pattern.push(t.norm);
  });
  // Slots at the edges would swallow neighbouring (often Indonesian) words.
  while (pattern[0] === SLOT) pattern.shift();
  while (pattern[pattern.length - 1] === SLOT) pattern.pop();
  return pattern;
}

/** Returns the index after the last matched token, or -1. */
function matchAt(tokens: Token[], at: number, pattern: string[], p = 0): number {
  if (p === pattern.length) return at;
  if (pattern[p] === SLOT) {
    for (let n = 1; n <= MAX_SLOT_WORDS && at + n <= tokens.length; n++) {
      const end = matchAt(tokens, at + n, pattern, p + 1);
      if (end !== -1) return end;
    }
    return -1;
  }
  if (at >= tokens.length || tokens[at]?.norm !== pattern[p]) return -1;
  return matchAt(tokens, at + 1, pattern, p + 1);
}

export function highlightEnglish(text: string, items: readonly string[]): TextSegment[] {
  const patterns = items
    .map(phrasePattern)
    .filter((p) => p.length > 0)
    // Longest first, so "Thank you very much" wins over "Thank you".
    .sort((a, b) => b.length - a.length);
  const tokens = tokenize(text);
  const ranges: { start: number; end: number }[] = [];

  let i = 0;
  while (i < tokens.length) {
    let best = -1;
    for (const p of patterns) {
      const end = matchAt(tokens, i, p);
      if (end > best) best = end;
    }
    if (best > i) {
      const first = tokens[i];
      const last = tokens[best - 1];
      if (first && last) {
        const prev = ranges[ranges.length - 1];
        // Merge with the previous range when only spaces/punctuation separate them.
        if (prev && /^[\s,.;:!?'"’“”-]*$/.test(text.slice(prev.end, first.start))) prev.end = last.end;
        else ranges.push({ start: first.start, end: last.end });
      }
      i = best;
    } else {
      i++;
    }
  }

  const segments: TextSegment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) segments.push({ text: text.slice(pos, r.start), english: false });
    segments.push({ text: text.slice(r.start, r.end), english: true });
    pos = r.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), english: false });
  return segments;
}
