import { test, assert, assertEqual, assertClose } from './harness.js';
import { mulberry32 } from '../../js/lib/random.js';
import {
  STRUCTURED, CELLS, parseShape, hasLine, isMirrored, touchingPairs, looksStructured, randomGrid, buildTrials,
  replacementGrid, compareGrid, scoreTrial, summarize, patternsSummaryText,
} from '../../js/patterns-logic.js';

test('parseShape reads a picture row by row', () => {
  assertEqual(parseShape(['#.....', '......', '......', '......', '......', '.....#']), [0, 35]);
});

test('every structured shape has 10 to 14 cells, a unique name, and looks structured', () => {
  assertEqual(new Set(STRUCTURED.map((s) => s.name)).size, STRUCTURED.length);
  for (const s of STRUCTURED) {
    assert(s.cells.length >= 10 && s.cells.length <= 14, `${s.name} has ${s.cells.length} cells`);
    assert(looksStructured(s.cells), `${s.name} should look structured`);
  }
});

test('structure checks catch lines, mirrors, and clumps', () => {
  assert(hasLine([0, 7, 14, 21]), 'diagonal line of 4');
  assert(!hasLine([0, 1, 2, 10]), 'line of 3 only');
  assert(isMirrored([0, 5]), 'left-right mirror');
  assert(!isMirrored([0, 4]), 'not a mirror');
  assertEqual(touchingPairs([0, 1, 6, 7]), 4);
});

test('randomGrid: 1,000 grids at every count are exact, scattered, and valid', () => {
  const rng = mulberry32(31);
  for (let i = 0; i < 1000; i++) {
    for (const count of [10, 11, 12, 13, 14]) {
      const cells = randomGrid(rng, count);
      assertEqual(cells.length, count);
      assertEqual(new Set(cells).size, count, 'duplicate cell');
      assert(cells.every((c) => c >= 0 && c < CELLS), 'cell out of range');
      assert(!looksStructured(cells), `grid looks structured: ${cells}`);
    }
  }
});

test('buildTrials: 1,000 lists have matched pairs and no repeated shapes', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const { practice, scored, used } = buildTrials(mulberry32(seed));
    assertEqual(practice.length, 2);
    assertEqual(practice[0].cells.length, practice[1].cells.length);
    assertEqual(scored.length, 8);
    const structured = scored.filter((t) => t.kind === 'structured');
    const random = scored.filter((t) => t.kind === 'random');
    assertEqual(structured.length, 4);
    assertEqual(random.length, 4);
    const counts = (list) => list.map((t) => t.cells.length).sort((a, b) => a - b);
    assertEqual(counts(structured), counts(random), `seed ${seed}: counts not matched`);
    const names = [practice[0].name, ...structured.map((t) => t.name)];
    assertEqual(new Set(names).size, 5, `seed ${seed}: repeated shape`);
    assertEqual(used.length, 5);
  }
});

test('replacementGrid keeps the count and swaps in an unused shape', () => {
  const rng = mulberry32(8);
  const square = STRUCTURED.find((s) => s.name === 'square');
  const r = replacementGrid(rng, { kind: 'structured', name: 'square', cells: square.cells }, ['square']);
  assertEqual(r.cells.length, square.cells.length);
  assert(r.name !== 'square', 'should pick a different shape with the same count');
  const rand = replacementGrid(rng, { kind: 'random', cells: randomGrid(rng, 12) }, []);
  assertEqual(rand.cells.length, 12);
  const letterE = STRUCTURED.find((s) => s.name === 'letter E');
  assertEqual(replacementGrid(rng, { kind: 'structured', name: 'letter E', cells: letterE.cells }, ['letter E']).name, 'letter E');
});

test('compareGrid and scoreTrial', () => {
  const target = [1, 2, 3, 4];
  const { correct, missed, extra } = compareGrid(target, [1, 2, 9]);
  assertEqual(correct, [1, 2]);
  assertEqual(missed, [3, 4]);
  assertEqual(extra, [9]);
  assertClose(scoreTrial(target, [1, 2, 9]), 0.25); // (2 - 1) / 4
  assertEqual(scoreTrial(target, [7, 8, 9]), 0); // floored at zero
  assertEqual(scoreTrial(target, [1, 2, 3, 4]), 1);
});

test('summarize outcomes and summary text', () => {
  const s = summarize([
    { kind: 'structured', score: 1 }, { kind: 'structured', score: 0.8 },
    { kind: 'random', score: 0.5 }, { kind: 'random', score: 0.6 },
  ]);
  assertClose(s.structured, 90);
  assertClose(s.random, 55);
  assertEqual(s.outcome, 'chunking');
  assertEqual(summarize([{ kind: 'structured', score: 0.6 }, { kind: 'random', score: 0.55 }]).outcome, 'same');
  assertEqual(summarize([{ kind: 'structured', score: 0.4 }, { kind: 'random', score: 0.6 }]).outcome, 'reversed');
  assertEqual(patternsSummaryText(s), 'Pattern memory: structured grids 90%, random grids 55%, 4 trials.');
});
