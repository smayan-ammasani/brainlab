import { test, assert, assertEqual, assertClose } from './harness.js';
import {
  mulberry32, mean, meanAbsDev, randomWait, classifyResponse, summarize,
  pathwaySegments, audioTimeToPerf, alternatingKinds, compareSenses,
  sightSummaryText, senseSummaryText, axisFor, WAIT_MIN_MS, WAIT_MAX_MS,
} from '../../js/reaction-time-logic.js';

test('mulberry32: same seed gives the same sequence', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) assertEqual(a(), b());
});

test('mulberry32: values stay in [0, 1) and differ by seed', () => {
  const r = mulberry32(7);
  for (let i = 0; i < 10000; i++) {
    const v = r();
    assert(v >= 0 && v < 1, `out of range: ${v}`);
  }
  assert(mulberry32(1)() !== mulberry32(2)(), 'different seeds should differ');
});

test('mean and mean absolute deviation', () => {
  assertEqual(mean([2, 4, 6]), 4);
  assert(Number.isNaN(mean([])), 'mean of nothing is NaN');
  // values 2,4,6: distances from 4 are 2,0,2, so MAD = 4/3
  assertClose(meanAbsDev([2, 4, 6]), 4 / 3);
  assertEqual(meanAbsDev([5, 5, 5]), 0);
});

test('randomWait stays between 1.5 and 4 seconds', () => {
  const r = mulberry32(3);
  for (let i = 0; i < 1000; i++) {
    const w = randomWait(r);
    assert(w >= WAIT_MIN_MS && w <= WAIT_MAX_MS, `bad wait ${w}`);
  }
});

test('classifyResponse: too soon, ok, lapse', () => {
  assertEqual(classifyResponse(-50), 'too-soon');
  assertEqual(classifyResponse(99.9), 'too-soon');
  assertEqual(classifyResponse(100), 'ok');
  assertEqual(classifyResponse(1500), 'ok');
  assertEqual(classifyResponse(1500.1), 'lapse');
});

test('summarize leaves lapses out of the average', () => {
  const s = summarize([200, 300, 2000]);
  assertEqual(s.count, 3);
  assertEqual(s.lapses, 1);
  assertEqual(s.average, 250);
  assertEqual(s.fastest, 200);
  assertEqual(s.spread, 50);
});

test('summarize falls back to all tries if every try was a lapse', () => {
  const s = summarize([1600, 1800]);
  assertEqual(s.lapses, 2);
  assertEqual(s.average, 1700);
});

test('pathwaySegments puts the leftover time in the last segment', () => {
  const segs = pathwaySegments(300);
  assertEqual(segs.map((s) => s.id), ['see', 'move', 'rest']);
  assertClose(segs.reduce((sum, s) => sum + s.ms, 0), 300);
  assertEqual(pathwaySegments(50)[2].ms, 0);
});

test('audioTimeToPerf uses getOutputTimestamp when it has a value', () => {
  // Speaker is playing context time 10 s at performance time 5000 ms.
  // A tone scheduled at 11.5 s should play at 6500 ms.
  const t = audioTimeToPerf({ when: 11.5, contextTime: 10, performanceTime: 5000, currentTime: 10.2, now: 4900, outputLatency: 0.05 });
  assertClose(t, 6500);
});

test('audioTimeToPerf falls back to currentTime plus outputLatency', () => {
  const t = audioTimeToPerf({ when: 3, contextTime: 0, performanceTime: 0, currentTime: 2, now: 1000, outputLatency: 0.04 });
  assertClose(t, 1000 + 1000 + 40);
  const u = audioTimeToPerf({ when: 3, currentTime: 2, now: 1000 });
  assertClose(u, 2000);
});

test('alternatingKinds starts with sound and alternates', () => {
  const kinds = alternatingKinds(12);
  assertEqual(kinds.length, 12);
  assertEqual(kinds.slice(0, 4), ['sound', 'sight', 'sound', 'sight']);
  assertEqual(kinds.filter((k) => k === 'sound').length, 6);
});

test('compareSenses sorts the outcome', () => {
  assertEqual(compareSenses(300, 250).outcome, 'sound-faster');
  assertEqual(compareSenses(300, 295).outcome, 'same');
  assertEqual(compareSenses(250, 300).outcome, 'sight-faster');
  assertEqual(compareSenses(300, 250).difference, 50);
});

test('summary texts read correctly', () => {
  const s = { count: 10, lapses: 0, average: 287.2, fastest: 241, spread: 23.4 };
  assertEqual(sightSummaryText(s), 'Reaction time (sight): average 287 ms, fastest 241 ms, typical spread 23 ms, 10 trials.');
  assertEqual(sightSummaryText({ ...s, lapses: 1 }).endsWith('10 trials, 1 slow try left out.'), true);
  const text = senseSummaryText({ average: 290, count: 6 }, { average: 251, count: 6 });
  assertEqual(text, 'Reaction time (sight vs. sound): sight average 290 ms, sound average 251 ms, sound was 39 ms faster, 12 trials.');
});

test('axisFor covers every value with round ticks', () => {
  for (const values of [[241, 287, 330], [180, 2400], [500, 500], [95, 120]]) {
    const { min, max, ticks } = axisFor(values);
    assert(min <= Math.min(...values) && max >= Math.max(...values), `range ${min}-${max} misses ${values}`);
    assert(ticks.length >= 3, 'needs at least three ticks');
    assertEqual(ticks[0], min);
    assertEqual(ticks[ticks.length - 1], max);
  }
});
