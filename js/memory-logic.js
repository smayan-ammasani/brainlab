// Pure logic for the working memory and chunking experiment. No DOM access.

import { randomInt, pick } from './lib/random.js';

export const START_LENGTH = 4;
export const CAPS = { random: 12, patterned: 16 };
export const PRACTICE_LENGTH = 3;
export const PRACTICE_TRIES = 2;
export const DIGIT_ON_MS = 800;
export const DIGIT_OFF_MS = 200; // the blank makes a repeated digit show up as two digits

// Number strings middle schoolers might turn into jokes, plus a few with
// ugly meanings. They never appear anywhere in a sequence, in either track.
export const BLOCKED = ['69', '420', '666', '8008', '80085', '5318008', '1488', '911', '177013', '58008'];

// Chunks a typical 11 to 14 year old already knows. Patterned sequences are
// built by joining these. Nothing here needs specific cultural or historical
// knowledge. Lengths 2 to 4 let us hit any target length exactly.
export const POOL = [
  // counting runs
  '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321',
  '2468', '1357', '3579', '123', '234', '345', '456', '567', '678', '789', '987', '876', '765',
  '654', '543', '321', '246', '135',
  // doubles and repeats
  '1122', '3344', '5566', '7788', '111', '222', '555', '777', '888', '999',
  // round numbers
  '100', '200', '300', '500', '1000', '50',
  // everyday numbers
  '365', '24', '60', '12', '360',
  // recent years
  '2000', '2020', '2025', '2026',
];

// Chunks of three or more digits are the ones a random sequence must not contain by accident.
const FAMILIAR = POOL.filter((c) => c.length >= 3);

export function hasBlocked(digits) {
  return BLOCKED.some((b) => digits.includes(b));
}

// A run of three counting up or down by one, like 456 or 987.
export function hasCountingRun(digits) {
  for (let i = 0; i + 2 < digits.length; i++) {
    const a = +digits[i];
    const b = +digits[i + 1];
    const c = +digits[i + 2];
    if (b - a === c - b && Math.abs(b - a) === 1) return true;
  }
  return false;
}

export function hasRepeat(digits) {
  for (let i = 1; i < digits.length; i++) if (digits[i] === digits[i - 1]) return true;
  return false;
}

export function hasFamiliarChunk(digits) {
  return FAMILIAR.some((c) => digits.includes(c));
}

// A random sequence: no digit twice in a row, no counting runs, no familiar
// chunks from the pool, nothing blocked.
export function randomSequence(rng, length) {
  for (;;) {
    let digits = '';
    while (digits.length < length) {
      const d = String(randomInt(rng, 10));
      if (digits.endsWith(d)) continue;
      if (hasCountingRun(digits.slice(-2) + d)) continue;
      digits += d;
    }
    if (!hasFamiliarChunk(digits) && !hasBlocked(digits)) return { digits, chunks: [digits] };
  }
}

// A patterned sequence: chunks from the pool joined until the length is exact.
// No chunk is used twice in one sequence. Two-digit chunks are weak, so they
// are used only when the length can't be made from 3s and 4s alone.
export function patternedSequence(rng, length) {
  const byLength = { 2: [], 3: [], 4: [] };
  for (const c of POOL) byLength[c.length].push(c);
  const unused = (n, chunks) => byLength[n].some((c) => !chunks.includes(c));
  for (;;) {
    const chunks = [];
    let left = length;
    while (left > 0) {
      // Never leave 1 digit (no 1-digit chunks). Prefer not to leave 2 or 5,
      // since those can only be finished with a 2-digit chunk.
      let sizes = [4, 3].filter((n) => n <= left && ![1, 2, 5].includes(left - n) && unused(n, chunks));
      if (sizes.length === 0) sizes = [4, 3, 2].filter((n) => n <= left && left - n !== 1 && unused(n, chunks));
      if (sizes.length === 0) break; // ran out of unused chunks; start over
      const size = pick(sizes, rng);
      chunks.push(pick(byLength[size].filter((c) => !chunks.includes(c)), rng));
      left -= size;
    }
    const digits = chunks.join('');
    if (left === 0 && !hasBlocked(digits)) return { digits, chunks };
  }
}

// ---------- The two staircases ----------

export function newTrack(kind) {
  return { kind, cap: CAPS[kind], length: START_LENGTH, misses: 0, span: 0, done: false };
}

// Up to two tries per length. A correct try moves up a length right away
// (a second try at that length could not change the result). Two misses at the
// same length end the track. Span is the longest length with a correct try.
export function recordTry(track, correct) {
  const t = { ...track };
  if (correct) {
    t.span = Math.max(t.span, t.length);
    if (t.length >= t.cap) t.done = true;
    else {
      t.length++;
      t.misses = 0;
    }
  } else {
    t.misses++;
    if (t.misses >= 2) t.done = true;
  }
  return t;
}

// The tracks take turns. When one ends, the other continues alone.
export function nextKind(tracks, lastKind) {
  const other = lastKind === 'random' ? 'patterned' : 'random';
  if (!tracks[other].done) return other;
  if (!tracks[lastKind].done) return lastKind;
  return null;
}

// Compares the two spans.
export function compareSpans(spans) {
  if (spans.patterned > spans.random) return 'chunking';
  if (spans.patterned === spans.random) return 'same';
  return 'reversed';
}

export function spanText(span) {
  return span > 0 ? String(span) : `under ${START_LENGTH}`;
}

export function memorySummaryText(spans) {
  return `Working memory: random digits span ${spanText(spans.random)}, patterned digits span ${spanText(spans.patterned)}.`;
}

// Picks the patterned sequence to show in the reveal: the longest one answered
// correctly, or else the longest one shown.
export function revealExample(tries) {
  const patterned = tries.filter((t) => t.kind === 'patterned');
  const right = patterned.filter((t) => t.correct);
  const list = right.length ? right : patterned;
  if (list.length === 0) return null;
  const best = list.reduce((a, b) => (b.digits.length > a.digits.length ? b : a));
  return { ...best, wasCorrect: right.length > 0 };
}
