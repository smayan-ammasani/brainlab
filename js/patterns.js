// Pattern memory and expertise: page logic.
// Each grid shows for 5 seconds, then clears so the student can rebuild it.
// The grid is one tab stop (roving tabindex): arrow keys move, Space toggles.

import {
  buildTrials, replacementGrid, compareGrid, scoreTrial, summarize, patternsSummaryText, SIZE, CELLS, SHOW_MS,
} from './patterns-logic.js';
import { mulberry32, seedFromClock } from './lib/random.js';
import { $, showOnly as showSections, announce, fill, copyResults, clearCopyBoxes, onTabHidden } from './lib/page.js';
import { drawBars } from './lib/charts.js';

const rng = mulberry32(seedFromClock());
const SECTIONS = ['intro-body', 'run', 'results', 'explain', 'talk', 'deeper'];
const grid = $('grid');
const timerBar = $('timer-bar');
const cells = [];

let phase = 'idle'; // 'show', 'rebuild', 'feedback', or 'idle'
let paused = false;
let pausedPhase = null;
let plan = null; // { practice, scored, used }
let queue = [];
let index = 0;
let practice = true;
let trial = null; // { kind, name, cells }
let picked = new Set();
let results = [];
let showTimer = 0;
let focusIndex = 0;
let summary = null;

const showOnly = (ids) => showSections(SECTIONS, ids);

// ---------- The grid ----------

function buildGrid() {
  for (let i = 0; i < CELLS; i++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell';
    button.setAttribute('aria-label', `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}`);
    button.setAttribute('aria-pressed', 'false');
    button.tabIndex = i === 0 ? 0 : -1;
    button.addEventListener('click', () => toggle(i));
    button.addEventListener('focus', () => moveFocus(i, false));
    grid.append(button);
    cells.push(button);
  }
}

// Paints every cell. classFor(i) returns the extra class for cell i, or ''.
function paint(classFor) {
  cells.forEach((cell, i) => {
    cell.className = `cell ${classFor(i)}`.trim();
    cell.setAttribute('aria-pressed', String(picked.has(i)));
  });
}

function moveFocus(i, focus = true) {
  cells[focusIndex].tabIndex = -1;
  focusIndex = i;
  cells[i].tabIndex = 0;
  if (focus) cells[i].focus();
}

function toggle(i) {
  if (phase !== 'rebuild' || paused) return;
  if (picked.has(i)) picked.delete(i);
  else picked.add(i);
  cells[i].setAttribute('aria-pressed', String(picked.has(i)));
}

grid.addEventListener('keydown', (event) => {
  let row = Math.floor(focusIndex / SIZE);
  let col = focusIndex % SIZE;
  if (event.key === 'ArrowUp') row = Math.max(0, row - 1);
  else if (event.key === 'ArrowDown') row = Math.min(SIZE - 1, row + 1);
  else if (event.key === 'ArrowLeft') col = Math.max(0, col - 1);
  else if (event.key === 'ArrowRight') col = Math.min(SIZE - 1, col + 1);
  else return;
  event.preventDefault();
  moveFocus(row * SIZE + col);
});

// Restarts the 5-second bar. Reading offsetWidth makes the browser notice the
// class was removed, so the animation starts over.
function startTimerBar() {
  timerBar.classList.remove('running', 'off');
  void timerBar.offsetWidth;
  timerBar.classList.add('running');
}

// ---------- Trials ----------

function start() {
  plan = buildTrials(rng);
  results = [];
  practice = true;
  queue = plan.practice;
  index = 0;
  showOnly(['run']);
  $('run-heading').focus();
  showTrial();
}

function showTrial() {
  trial = queue[index];
  phase = 'show';
  picked = new Set();
  $('run-heading').textContent = practice ? 'Practice' : 'Real grids';
  $('run-progress').textContent = `${practice ? 'Practice grid' : 'Grid'} ${index + 1} of ${queue.length}`;
  paint((i) => (trial.cells.includes(i) ? 'filled' : ''));
  grid.inert = true;
  grid.classList.add('showing');
  $('feedback').hidden = true;
  $('check').hidden = true;
  $('next').hidden = true;
  $('board-prompt').textContent = 'Memorize the pattern! You have 5 seconds.';
  $('board-prompt').focus();
  startTimerBar();
  showTimer = setTimeout(startRebuild, SHOW_MS);
}

function startRebuild() {
  phase = 'rebuild';
  paint(() => '');
  grid.inert = false;
  grid.classList.remove('showing');
  timerBar.classList.add('off');
  timerBar.classList.remove('running');
  $('board-prompt').textContent = 'Now rebuild it. Fill the squares that were filled, then press Check.';
  $('check').hidden = false;
  moveFocus(focusIndex);
  announce('Now rebuild the pattern, then press Check.');
}

function check() {
  if (phase !== 'rebuild') return;
  phase = 'feedback';
  const { correct, missed, extra } = compareGrid(trial.cells, [...picked]);
  const marks = new Map();
  for (const i of correct) marks.set(i, 'cell-correct');
  for (const i of missed) marks.set(i, 'cell-missed');
  for (const i of extra) marks.set(i, 'cell-extra');
  paint((i) => marks.get(i) || '');
  grid.inert = true;
  if (!practice) results.push({ kind: trial.kind, score: scoreTrial(trial.cells, [...picked]) });
  const extraText = extra.length ? `, plus ${extra.length} extra` : '';
  const message = `You got ${correct.length} of ${trial.cells.length} squares${extraText}.`;
  $('board-prompt').textContent = "Here's how you did.";
  $('trial-score').textContent = message;
  $('feedback').hidden = false;
  $('check').hidden = true;
  $('next').hidden = false;
  $('next').focus();
  announce(message);
}

function next() {
  index++;
  if (index < queue.length) {
    showTrial();
  } else if (practice) {
    practice = false;
    queue = plan.scored;
    index = 0;
    announce('Practice done! Now 8 real grids.');
    showTrial();
  } else {
    showResults();
  }
}

function pause() {
  if (phase === 'idle' || paused) return;
  paused = true;
  pausedPhase = phase;
  clearTimeout(showTimer);
  timerBar.classList.remove('running');
  $('board').hidden = true;
  $('paused').hidden = false;
  $('pause').hidden = true;
  $('paused-text').textContent = phase === 'show'
    ? "That grid was thrown out. You'll get a fresh one when you're ready, so a quick look won't count."
    : 'Your grid is saved. You can pick up where you left off.';
  $('paused-heading').focus();
  announce('Paused');
}

function resume() {
  paused = false;
  $('board').hidden = false;
  $('paused').hidden = true;
  $('pause').hidden = false;
  if (pausedPhase === 'show') {
    // The student may have seen part of the grid, so swap in a fresh one.
    const fresh = replacementGrid(rng, trial, plan.used);
    if (fresh.name && !plan.used.includes(fresh.name)) plan.used.push(fresh.name);
    queue[index] = fresh;
    showTrial();
  } else if (pausedPhase === 'rebuild') {
    moveFocus(focusIndex);
  } else {
    $('next').focus();
  }
}

function reset() {
  clearTimeout(showTimer);
  phase = 'idle';
  paused = false;
  summary = null;
  $('board').hidden = false;
  $('paused').hidden = true;
  $('pause').hidden = false;
  clearCopyBoxes();
  showOnly(['intro-body']);
  $('intro-heading').focus();
}

// ---------- Results ----------

function showResults() {
  phase = 'idle';
  summary = summarize(results);
  fill('structured', Math.round(summary.structured));
  fill('random', Math.round(summary.random));
  for (const el of document.querySelectorAll('[data-outcome]')) el.hidden = el.dataset.outcome !== summary.outcome;
  showOnly(['results', 'explain', 'talk', 'deeper']);
  drawBars($('pattern-bars'), [
    { label: 'Shapes', value: summary.structured, cls: 'bar-a' },
    { label: 'Random', value: summary.random, cls: 'bar-b' },
  ], `Average score: shape grids ${Math.round(summary.structured)}%, random grids ${Math.round(summary.random)}%`,
  (v) => `${Math.round(v)}%`, 100);
  $('results-heading').focus();
  announce('Done! Here are your results.');
}

// ---------- Input ----------

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('run').hidden && !paused) pause();
});

onTabHidden(pause);

buildGrid();
$('start').addEventListener('click', start);
$('check').addEventListener('click', check);
$('next').addEventListener('click', next);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', reset);
$('again').addEventListener('click', reset);
document.querySelector('.copy-btn').addEventListener('click', (event) => {
  copyResults(event.currentTarget, patternsSummaryText(summary));
});
