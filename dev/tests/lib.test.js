import { test, assert, assertEqual, assertClose } from './harness.js';
import { mulberry32, randomInt, pick, shuffle } from '../../js/lib/random.js';
import { mean, meanAbsDev } from '../../js/lib/stats.js';

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

test('randomInt covers 0 to n - 1 and nothing else', () => {
  const r = mulberry32(11);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(randomInt(r, 4));
  assertEqual([...seen].sort(), [0, 1, 2, 3]);
});

test('pick and shuffle', () => {
  const r = mulberry32(5);
  const items = [1, 2, 3, 4, 5, 6];
  const s = shuffle(items, r);
  assertEqual([...s].sort(), items);
  assertEqual(items, [1, 2, 3, 4, 5, 6]); // original untouched
  for (let i = 0; i < 100; i++) assert(items.includes(pick(items, r)), 'pick returned a stranger');
});

test('mean and mean absolute deviation', () => {
  assertEqual(mean([2, 4, 6]), 4);
  assert(Number.isNaN(mean([])), 'mean of nothing is NaN');
  // values 2,4,6: distances from 4 are 2,0,2, so MAD = 4/3
  assertClose(meanAbsDev([2, 4, 6]), 4 / 3);
  assertEqual(meanAbsDev([5, 5, 5]), 0);
});
