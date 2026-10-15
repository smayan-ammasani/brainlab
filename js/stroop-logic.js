// Pure logic for the Stroop test. No DOM access, so it can be tested.

import { randomInt } from './lib/random.js';
import { mean } from './lib/stats.js';

export const OPTIONS = 4; // four colors, or the counts 1 to 4
export const COLORS = ['ORANGE', 'BLUE', 'GREEN', 'PINK']; // button order, left to right
export const PRACTICE = { match: 4, mismatch: 4 };
export const TRIALS = { match: 20, mismatch: 20 };
export const MAX_RUN = 3; // no more than three of the same type in a row
export const FIXATION_MS = 500;
export const TIMEOUT_MS = 3000;
export const SAME_WITHIN_MS = 20; // effects smaller than this count as "about the same"

function endsWithRun(order, type, maxRun) {
  return order.length >= maxRun && order.slice(-maxRun).every((t) => t === type);
}

// The order of 'match' and 'mismatch' tries: exact counts, and no run longer
// than maxRun. Picks are weighted by how many of each are left, so the two
// types run out together. If it ever paints itself into a corner, it starts over.
export function buildTypeOrder(rng, counts, maxRun = MAX_RUN) {
  const total = counts.match + counts.mismatch;
  for (;;) {
    const left = { ...counts };
    const order = [];
    while (order.length < total) {
      const options = ['match', 'mismatch'].filter((t) => left[t] > 0 && !endsWithRun(order, t, maxRun));
      if (options.length === 0) break;
      let type = options[0];
      if (options.length === 2) type = rng() * (left.match + left.mismatch) < left.match ? 'match' : 'mismatch';
      order.push(type);
      left[type]--;
    }
    if (order.length === total) return order;
  }
}

// A full list of tries. `word` is what is printed (a color word, or a digit),
// `ink` is the right answer (the ink color, or how many digits). Both are 0 to 3.
// Matching tries have word === ink. The same word never appears twice in a row.
export function buildTrials(rng, counts) {
  const trials = [];
  let previousWord = -1;
  for (const type of buildTypeOrder(rng, counts)) {
    let word;
    do word = randomInt(rng, OPTIONS); while (word === previousWord);
    let ink = word;
    if (type === 'mismatch') {
      do ink = randomInt(rng, OPTIONS); while (ink === word);
    }
    trials.push({ type, word, ink });
    previousWord = word;
  }
  return trials;
}

// What the numbers version shows: the digit (word + 1), repeated ink + 1 times.
export function digitDisplay({ word, ink }) {
  return Array(ink + 1).fill(String(word + 1)).join(' ');
}

// results: [{ type, correct, rt }], rt is null when the try timed out.
// Only correct tries are timed.
export function scoreStroop(results) {
  const side = (type) => {
    const rows = results.filter((r) => r.type === type);
    const correct = rows.filter((r) => r.correct);
    return { average: mean(correct.map((r) => r.rt)), mistakes: rows.length - correct.length, count: rows.length };
  };
  const match = side('match');
  const mismatch = side('mismatch');
  const effect = mismatch.average - match.average;
  let outcome = 'effect';
  if (!Number.isFinite(effect)) outcome = 'none';
  else if (effect <= -SAME_WITHIN_MS) outcome = 'reversed';
  else if (effect < SAME_WITHIN_MS) outcome = 'same';
  return { match, mismatch, effect, outcome };
}

export function stroopSummaryText(version, s) {
  const ms = (v) => (Number.isFinite(v) ? `${Math.round(v)} ms` : 'none');
  return `Stroop test (${version}): matching average ${ms(s.match.average)}, mismatching average ${ms(s.mismatch.average)}, ` +
    `Stroop effect ${ms(s.effect)}, mistakes ${s.match.mistakes} matching and ${s.mismatch.mistakes} mismatching, ` +
    `${s.match.count + s.mismatch.count} trials.`;
}
