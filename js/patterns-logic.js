// Pure logic for the pattern memory experiment. No DOM access.
// A grid is a sorted list of filled cell indexes, 0 to 35, row by row.

import { pick, shuffle } from './lib/random.js';

export const SIZE = 6;
export const CELLS = SIZE * SIZE;
export const SHOW_MS = 5000;
export const SCORED_PER_KIND = 4;
export const SAME_WITHIN_POINTS = 10; // percent-point differences smaller than this count as "about the same"

// Turns a picture ('#' filled, '.' empty, one string per row) into cell indexes.
export function parseShape(rows) {
  const cells = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push(r * SIZE + c); }));
  return cells;
}

// Shapes a middle schooler already knows: letters, simple shapes, symmetric
// figures, a staircase, and corners. Each has 10 to 14 filled cells.
export const STRUCTURED = Object.entries({
  'letter L': ['#.....', '#.....', '#.....', '#.....', '#.....', '######'],
  'letter T': ['######', '..#...', '..#...', '..#...', '..#...', '..#...'],
  'letter H': ['#...#.', '#...#.', '#####.', '#...#.', '#...#.', '......'],
  'letter E': ['####..', '#.....', '####..', '#.....', '####..', '......'],
  'letter Z': ['#####.', '...#..', '..#...', '.#....', '#####.', '......'],
  'letter U': ['#...#.', '#...#.', '#...#.', '#...#.', '#####.', '......'],
  'letter C': ['.####.', '#.....', '#.....', '#.....', '.####.', '......'],
  'square': ['......', '.####.', '.#..#.', '.#..#.', '.####.', '......'],
  'plus sign': ['..#...', '..#...', '######', '..#...', '..#...', '..#...'],
  'X': ['#....#', '.#..#.', '..##..', '..##..', '.#..#.', '#....#'],
  'diamond': ['..##..', '.#..#.', '#....#', '#....#', '.#..#.', '..##..'],
  'arrow': ['...#..', '....#.', '######', '....#.', '...#..', '......'],
  'staircase': ['#.....', '##....', '.##...', '..##..', '...##.', '....##'],
  'smiley face': ['......', '.#..#.', '.#..#.', '......', '#....#', '.####.'],
  'corners': ['###...', '#.....', '#.....', '.....#', '.....#', '...###'],
  'blocks': ['##....', '##....', '..##..', '..##..', '....##', '....##'],
}).map(([name, rows]) => ({ name, cells: parseShape(rows) }));

const rc = (i) => [Math.floor(i / SIZE), i % SIZE];

// A straight line of `length` or more filled cells: across, down, or diagonal.
export function hasLine(cells, length = 4) {
  const filled = new Set(cells);
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const i of cells) {
    const [r, c] = rc(i);
    for (const [dr, dc] of directions) {
      let n = 1;
      let rr = r + dr;
      let cc = c + dc;
      while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && filled.has(rr * SIZE + cc)) {
        n++;
        rr += dr;
        cc += dc;
      }
      if (n >= length) return true;
    }
  }
  return false;
}

// True if the grid is its own mirror image, left to right or top to bottom.
export function isMirrored(cells) {
  const filled = new Set(cells);
  const leftRight = cells.every((i) => { const [r, c] = rc(i); return filled.has(r * SIZE + (SIZE - 1 - c)); });
  const topBottom = cells.every((i) => { const [r, c] = rc(i); return filled.has((SIZE - 1 - r) * SIZE + c); });
  return leftRight || topBottom;
}

// How many pairs of filled cells touch side by side.
export function touchingPairs(cells) {
  const filled = new Set(cells);
  let pairs = 0;
  for (const i of cells) {
    const [r, c] = rc(i);
    if (c + 1 < SIZE && filled.has(i + 1)) pairs++;
    if (r + 1 < SIZE && filled.has(i + SIZE)) pairs++;
  }
  return pairs;
}

export const MAX_TOUCHING = 4;

export function looksStructured(cells) {
  return hasLine(cells) || isMirrored(cells) || touchingPairs(cells) > MAX_TOUCHING;
}

// A scattered grid with exactly `count` filled cells that doesn't look like a shape.
export function randomGrid(rng, count) {
  const all = Array.from({ length: CELLS }, (_, i) => i);
  for (;;) {
    const cells = shuffle(all, rng).slice(0, count).sort((a, b) => a - b);
    if (!looksStructured(cells)) return cells;
  }
}

// Practice: one structured and one random grid. Real tries: four structured
// grids, each paired with a random grid that has the same number of filled
// cells, all eight in random order.
export function buildTrials(rng) {
  const shapes = shuffle(STRUCTURED, rng);
  const practiceShape = shapes[0];
  const practice = [
    { kind: 'structured', name: practiceShape.name, cells: practiceShape.cells },
    { kind: 'random', cells: randomGrid(rng, practiceShape.cells.length) },
  ];
  const scored = [];
  for (const shape of shapes.slice(1, 1 + SCORED_PER_KIND)) {
    scored.push({ kind: 'structured', name: shape.name, cells: shape.cells });
    scored.push({ kind: 'random', cells: randomGrid(rng, shape.cells.length) });
  }
  return { practice, scored: shuffle(scored, rng), used: shapes.slice(0, 1 + SCORED_PER_KIND).map((s) => s.name) };
}

// A fresh grid to replace one that was thrown out (the student saw part of it).
// Random grids get a new random grid. Structured grids get an unused shape with
// the same count if there is one, so the pairing stays fair.
export function replacementGrid(rng, trial, usedNames) {
  if (trial.kind === 'random') return { ...trial, cells: randomGrid(rng, trial.cells.length) };
  const options = STRUCTURED.filter((s) => s.cells.length === trial.cells.length && !usedNames.includes(s.name));
  if (options.length === 0) return trial;
  const shape = pick(options, rng);
  return { kind: 'structured', name: shape.name, cells: shape.cells };
}

// Compares the student's picks with the real grid.
export function compareGrid(target, picked) {
  const t = new Set(target);
  const p = new Set(picked);
  const correct = target.filter((i) => p.has(i));
  const missed = target.filter((i) => !p.has(i));
  const extra = picked.filter((i) => !t.has(i));
  return { correct, missed, extra };
}

// Score: correct minus extra, floored at zero, divided by the number of filled cells.
export function scoreTrial(target, picked) {
  const { correct, extra } = compareGrid(target, picked);
  return Math.max(0, correct.length - extra.length) / target.length;
}

export function summarize(results) {
  const avg = (kind) => {
    const list = results.filter((r) => r.kind === kind).map((r) => r.score);
    return list.length ? (100 * list.reduce((a, b) => a + b, 0)) / list.length : 0;
  };
  const structured = avg('structured');
  const random = avg('random');
  const difference = structured - random;
  let outcome = 'chunking';
  if (difference <= -SAME_WITHIN_POINTS) outcome = 'reversed';
  else if (difference < SAME_WITHIN_POINTS) outcome = 'same';
  return { structured, random, difference, outcome, count: results.length };
}

export function patternsSummaryText(s) {
  return `Pattern memory: structured grids ${Math.round(s.structured)}%, random grids ${Math.round(s.random)}%, ${s.count} trials.`;
}
