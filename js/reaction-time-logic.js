// Pure logic for the reaction time experiment. No DOM access, so it can be tested.

import { mean, meanAbsDev } from './lib/stats.js';
import { GUESS_MS } from './lib/timing.js';

export const LAPSE_MS = 1500; // slower than this is shown but left out of the average
export const WAIT_MIN_MS = 1500;
export const WAIT_MAX_MS = 4000;

// Random wait before the stimulus, so it cannot be predicted.
export function randomWait(rng) {
  return WAIT_MIN_MS + rng() * (WAIT_MAX_MS - WAIT_MIN_MS);
}

// Sorts a response time into 'too-soon', 'lapse', or 'ok'.
// A negative time means the press came before the stimulus.
export function classifyResponse(rt) {
  if (rt < GUESS_MS) return 'too-soon';
  if (rt > LAPSE_MS) return 'lapse';
  return 'ok';
}

// Summary numbers for a list of response times (ms). Lapses are excluded
// from the average, fastest, and spread. If every try was a lapse, all tries
// are used so there is still something to show.
export function summarize(times) {
  const valid = times.filter((t) => t <= LAPSE_MS);
  const used = valid.length > 0 ? valid : times;
  return {
    count: times.length,
    lapses: times.length - valid.length,
    average: mean(used),
    fastest: Math.min(...used),
    spread: meanAbsDev(used),
  };
}

// Approximate time ranges for the known stages of the pathway (see
// dev/sources.md, RT-2 and RT-3). The rest of the student's average goes in
// a final "everything else" segment.
export const STAGES = [
  { id: 'see', low: 50, high: 70 },
  { id: 'move', low: 20, high: 25 },
];

export function pathwaySegments(average) {
  const known = STAGES.map((s) => ({ ...s, ms: (s.low + s.high) / 2 }));
  const used = known.reduce((sum, s) => sum + s.ms, 0);
  return [...known, { id: 'rest', ms: Math.max(average - used, 0) }];
}

// Turns a scheduled AudioContext time (seconds) into the performance.now()
// timeline (ms). getOutputTimestamp() pairs the sample the speaker is playing
// right now (contextTime) with the moment it played (performanceTime), so it
// already includes the output device's delay. Without it, we map through
// currentTime and add outputLatency instead.
export function audioTimeToPerf({ when, contextTime, performanceTime, currentTime, now, outputLatency }) {
  if (performanceTime > 0) return performanceTime + (when - contextTime) * 1000;
  return now + (when - currentTime) * 1000 + (outputLatency || 0) * 1000;
}

// Sight and sound trials alternate in a fixed order, starting with sound,
// so practice helps both kinds equally.
export function alternatingKinds(count) {
  return Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 'sound' : 'sight'));
}

export const SAME_WITHIN_MS = 10; // differences smaller than this count as "about the same"

// Compares sight and sound averages. difference > 0 means sound was faster.
export function compareSenses(sightAverage, soundAverage) {
  const difference = sightAverage - soundAverage;
  let outcome = 'same';
  if (difference >= SAME_WITHIN_MS) outcome = 'sound-faster';
  else if (difference <= -SAME_WITHIN_MS) outcome = 'sight-faster';
  return { difference, outcome };
}

// Plain-text summaries for the "Copy my results" buttons.
export function sightSummaryText(s) {
  const lapses = s.lapses ? `, ${s.lapses} slow ${s.lapses === 1 ? 'try' : 'tries'} left out` : '';
  return `Reaction time (sight): average ${Math.round(s.average)} ms, fastest ${Math.round(s.fastest)} ms, ` +
    `typical spread ${Math.round(s.spread)} ms, ${s.count} trials${lapses}.`;
}

export function senseSummaryText(sight, sound) {
  const { difference, outcome } = compareSenses(sight.average, sound.average);
  const d = Math.round(Math.abs(difference));
  const verdict = outcome === 'sound-faster' ? `sound was ${d} ms faster`
    : outcome === 'sight-faster' ? `sight was ${d} ms faster`
    : 'about the same';
  return `Reaction time (sight vs. sound): sight average ${Math.round(sight.average)} ms, ` +
    `sound average ${Math.round(sound.average)} ms, ${verdict}, ${sight.count + sound.count} trials.`;
}

// Picks a "nice" axis range and tick step for a list of values (ms).
export function axisFor(values) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo;
  const step = range > 1200 ? 500 : range > 500 ? 200 : range > 150 ? 100 : 50;
  let min = Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  if (max === hi) max += step;
  if (min === lo && min > 0) min -= step;
  // Widen to at least two steps, on whichever side has less room.
  while (max - min < 2 * step) {
    if (lo - min < max - hi && min - step >= 0) min -= step;
    else max += step;
  }
  const ticks = [];
  for (let t = min; t <= max; t += step) ticks.push(t);
  return { min, max, ticks };
}
