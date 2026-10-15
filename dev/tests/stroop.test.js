import { test, assert, assertEqual } from './harness.js';
import { mulberry32 } from '../../js/lib/random.js';
import {
  buildTypeOrder, buildTrials, digitDisplay, scoreStroop, stroopSummaryText, TRIALS, PRACTICE, MAX_RUN, OPTIONS,
} from '../../js/stroop-logic.js';

function longestRun(list) {
  let best = 0;
  let run = 0;
  list.forEach((x, i) => {
    run = i > 0 && x === list[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

test('buildTypeOrder: exact counts and short runs over 1,000 lists', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const order = buildTypeOrder(mulberry32(seed), TRIALS);
    assertEqual(order.filter((t) => t === 'match').length, 20, `seed ${seed}`);
    assertEqual(order.filter((t) => t === 'mismatch').length, 20, `seed ${seed}`);
    assert(longestRun(order) <= MAX_RUN, `seed ${seed}: run of ${longestRun(order)}`);
  }
});

test('buildTrials: 1,000 lists follow every rule', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    for (const counts of [TRIALS, PRACTICE]) {
      const trials = buildTrials(mulberry32(seed), counts);
      assertEqual(trials.length, counts.match + counts.mismatch);
      trials.forEach((t, i) => {
        assert(t.word >= 0 && t.word < OPTIONS && t.ink >= 0 && t.ink < OPTIONS, `seed ${seed}: out of range`);
        if (t.type === 'match') assert(t.word === t.ink, `seed ${seed}: match with different ink`);
        else assert(t.word !== t.ink, `seed ${seed}: mismatch with same ink`);
        if (i > 0) assert(t.word !== trials[i - 1].word, `seed ${seed}: same word twice in a row at ${i}`);
      });
      assert(longestRun(trials.map((t) => t.type)) <= MAX_RUN, `seed ${seed}: long run`);
    }
  }
});

test('buildTrials: every word and ink gets used', () => {
  const trials = buildTrials(mulberry32(99), TRIALS);
  for (let k = 0; k < OPTIONS; k++) {
    assert(trials.some((t) => t.word === k), `word ${k} never used`);
    assert(trials.some((t) => t.ink === k), `ink ${k} never used`);
  }
});

test('digitDisplay repeats the digit by the count', () => {
  assertEqual(digitDisplay({ word: 3, ink: 1 }), '4 4');
  assertEqual(digitDisplay({ word: 1, ink: 1 }), '2 2');
  assertEqual(digitDisplay({ word: 2, ink: 3 }), '3 3 3 3');
});

test('scoreStroop times only correct tries and counts mistakes', () => {
  const s = scoreStroop([
    { type: 'match', correct: true, rt: 500 },
    { type: 'match', correct: true, rt: 600 },
    { type: 'match', correct: false, rt: 300 },
    { type: 'mismatch', correct: true, rt: 700 },
    { type: 'mismatch', correct: false, rt: null },
  ]);
  assertEqual(s.match.average, 550);
  assertEqual(s.mismatch.average, 700);
  assertEqual(s.effect, 150);
  assertEqual(s.match.mistakes, 1);
  assertEqual(s.mismatch.mistakes, 1);
  assertEqual(s.outcome, 'effect');
});

test('scoreStroop outcomes: same, reversed, none', () => {
  const two = (a, b) => scoreStroop([{ type: 'match', correct: true, rt: a }, { type: 'mismatch', correct: true, rt: b }]);
  assertEqual(two(600, 610).outcome, 'same');
  assertEqual(two(600, 560).outcome, 'reversed');
  assertEqual(scoreStroop([{ type: 'match', correct: true, rt: 600 }, { type: 'mismatch', correct: false, rt: 500 }]).outcome, 'none');
});

test('stroopSummaryText reads correctly', () => {
  const s = {
    match: { average: 612.4, mistakes: 0, count: 20 },
    mismatch: { average: 724.2, mistakes: 2, count: 20 },
    effect: 111.8,
  };
  assertEqual(stroopSummaryText('colors', s),
    'Stroop test (colors): matching average 612 ms, mismatching average 724 ms, Stroop effect 112 ms, mistakes 0 matching and 2 mismatching, 40 trials.');
});
