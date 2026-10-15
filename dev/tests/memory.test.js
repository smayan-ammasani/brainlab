import { test, assert, assertEqual } from './harness.js';
import { mulberry32 } from '../../js/lib/random.js';
import {
  POOL, BLOCKED, CAPS, randomSequence, patternedSequence, hasBlocked, hasCountingRun, hasRepeat, hasFamiliarChunk,
  newTrack, recordTry, nextKind, compareSpans, spanText, memorySummaryText, revealExample,
} from '../../js/memory-logic.js';

test('pattern checks catch what they should', () => {
  assert(hasCountingRun('1456'), '456 counts up');
  assert(hasCountingRun('8762'), '876 counts down');
  assert(!hasCountingRun('1357'), '1357 counts by twos, not ones');
  assert(hasRepeat('1223'), '22 repeats');
  assert(hasBlocked('31690'), '69 is blocked');
  assert(hasFamiliarChunk('83651'), '365 is familiar');
  assert(!hasFamiliarChunk('8361'), '8361 is not familiar');
});

test('the pool holds only digit chunks of length 2 to 4, none blocked, no duplicates', () => {
  assertEqual(new Set(POOL).size, POOL.length);
  for (const c of POOL) {
    assert(/^\d{2,4}$/.test(c), `bad chunk ${c}`);
    assert(!hasBlocked(c), `blocked chunk ${c}`);
  }
});

test('randomSequence: 1,000 sequences at every length follow every rule', () => {
  const rng = mulberry32(2024);
  for (let i = 0; i < 1000; i++) {
    for (const length of [3, 4, 7, 12]) {
      const { digits } = randomSequence(rng, length);
      assertEqual(digits.length, length);
      assert(/^\d+$/.test(digits), `not digits: ${digits}`);
      assert(!hasRepeat(digits), `repeat in ${digits}`);
      assert(!hasCountingRun(digits), `counting run in ${digits}`);
      assert(!hasFamiliarChunk(digits), `familiar chunk in ${digits}`);
      assert(!hasBlocked(digits), `blocked string in ${digits}`);
    }
  }
});

test('patternedSequence: 1,000 sequences at every length 4 to 16 are exact and clean', () => {
  const rng = mulberry32(77);
  for (let i = 0; i < 1000; i++) {
    for (let length = 4; length <= CAPS.patterned; length++) {
      const { digits, chunks } = patternedSequence(rng, length);
      assertEqual(digits.length, length, `length ${length}`);
      assertEqual(chunks.join(''), digits);
      assertEqual(new Set(chunks).size, chunks.length, `repeated chunk in ${chunks}`);
      for (const c of chunks) assert(POOL.includes(c), `chunk ${c} not in pool`);
      for (const b of BLOCKED) assert(!digits.includes(b), `blocked ${b} in ${digits}`);
    }
  }
});

test('staircase: up after a correct try, ends after two misses at one length', () => {
  let t = newTrack('random');
  assertEqual(t.length, 4);
  t = recordTry(t, true); // 4 right
  assertEqual(t.length, 5);
  t = recordTry(t, false); // 5 wrong once
  assertEqual(t.length, 5);
  assert(!t.done, 'one miss should not end it');
  t = recordTry(t, true); // 5 right on the second try
  assertEqual(t.length, 6);
  t = recordTry(t, false);
  t = recordTry(t, false); // 6 wrong twice
  assert(t.done, 'two misses should end it');
  assertEqual(t.span, 5);
});

test('staircase: span stays 0 if nothing is right, and stops at the cap', () => {
  let t = recordTry(recordTry(newTrack('random'), false), false);
  assert(t.done, 'done');
  assertEqual(t.span, 0);
  t = newTrack('random');
  while (!t.done) t = recordTry(t, true);
  assertEqual(t.span, CAPS.random);
  t = newTrack('patterned');
  while (!t.done) t = recordTry(t, true);
  assertEqual(t.span, CAPS.patterned);
});

test('nextKind alternates, then continues alone', () => {
  const tracks = { random: newTrack('random'), patterned: newTrack('patterned') };
  assertEqual(nextKind(tracks, 'random'), 'patterned');
  assertEqual(nextKind(tracks, 'patterned'), 'random');
  tracks.random.done = true;
  assertEqual(nextKind(tracks, 'patterned'), 'patterned');
  tracks.patterned.done = true;
  assertEqual(nextKind(tracks, 'patterned'), null);
});

test('compareSpans and summary text', () => {
  assertEqual(compareSpans({ random: 6, patterned: 11 }), 'chunking');
  assertEqual(compareSpans({ random: 7, patterned: 7 }), 'same');
  assertEqual(compareSpans({ random: 8, patterned: 6 }), 'reversed');
  assertEqual(spanText(0), 'under 4');
  assertEqual(memorySummaryText({ random: 7, patterned: 11 }), 'Working memory: random digits span 7, patterned digits span 11.');
});

test('revealExample picks the longest correct patterned try', () => {
  const tries = [
    { kind: 'patterned', digits: '24681000', chunks: ['2468', '1000'], correct: true },
    { kind: 'patterned', digits: '246810003651', chunks: ['2468', '1000', '365', '1'], correct: false },
    { kind: 'random', digits: '1795803', chunks: ['1795803'], correct: true },
  ];
  const ex = revealExample(tries);
  assertEqual(ex.digits, '24681000');
  assert(ex.wasCorrect, 'was correct');
  assertEqual(revealExample([{ kind: 'patterned', digits: '1234', chunks: ['1234'], correct: false }]).wasCorrect, false);
  assertEqual(revealExample([]), null);
});
