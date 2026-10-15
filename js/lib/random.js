// Seeded randomness. Every random choice on the site goes through a generator
// from mulberry32(), so tests can reproduce any sequence from its seed.

// mulberry32: a small, fast 32-bit generator. Returns a function that gives
// numbers in [0, 1). The same seed always gives the same sequence.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// In the real site, seed from the clock so every visit is different.
export function seedFromClock() {
  return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}

// A whole number from 0 to n - 1.
export function randomInt(rng, n) {
  return Math.floor(rng() * n);
}

export function pick(items, rng) {
  return items[randomInt(rng, items.length)];
}

// Returns a shuffled copy (Fisher-Yates).
export function shuffle(items, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
