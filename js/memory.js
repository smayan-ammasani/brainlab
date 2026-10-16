// Working memory and chunking: page logic.
// Two hidden staircases (random and patterned strings) take turns. Digits show
// for 800 ms with a 200 ms blank between them. Nothing here is a timed response,
// so plain timers are fine.

import {
  randomSequence, patternedSequence, newTrack, recordTry, nextKind, compareSpans, spanText,
  memorySummaryText, revealExample, PRACTICE_LENGTH, PRACTICE_TRIES, DIGIT_ON_MS, DIGIT_OFF_MS,
} from './memory-logic.js';
import { mulberry32, seedFromClock } from './lib/random.js';
import {
  $, showOnly as showSections, announce, fill, copyResults, clearCopyBoxes, onTabHidden, setPaused,
} from './lib/page.js';
import { drawBars } from './lib/charts.js';

const rng = mulberry32(seedFromClock());
const SECTIONS = ['intro-body', 'run', 'results', 'explain', 'talk', 'deeper'];
const READY_MS = 900; // "Get ready..." before each string
const FEEDBACK_MS = 1400;
const INTRO_MS = 2600;
const MAX_TYPED = 20;

let state = 'idle'; // 'idle', 'showing', 'typing', or 'feedback'
let paused = false;
let practiceLeft = 0;
let tracks = null;
let lastKind = 'patterned'; // so the first real try is random
let current = null; // the string being shown or typed: { kind, practice, digits, chunks }
let tries = []; // every real try
let typed = '';
let timers = [];
let spans = null;

const showOnly = (ids) => showSections(SECTIONS, ids);
const spaced = (digits) => digits.split('').join(' ');

function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function setStage(big, sub = '', isMessage = false) {
  $('digit').textContent = big;
  $('digit').classList.toggle('digit-msg', isMessage);
  $('stage-sub').textContent = sub;
}

// ---------- Running tries ----------

function start() {
  tracks = { random: newTrack('random'), patterned: newTrack('patterned') };
  tries = [];
  lastKind = 'patterned';
  practiceLeft = PRACTICE_TRIES;
  showOnly(['run']);
  $('run-heading').focus();
  nextTry();
}

function nextTry() {
  if (practiceLeft > 0) {
    current = { kind: 'random', practice: true, ...randomSequence(rng, PRACTICE_LENGTH) };
    $('run-heading').textContent = 'Practice';
    $('run-progress').textContent = `Practice try ${PRACTICE_TRIES - practiceLeft + 1} of ${PRACTICE_TRIES}`;
    present();
    return;
  }
  const kind = nextKind(tracks, lastKind);
  if (!kind) {
    showResults();
    return;
  }
  const { length } = tracks[kind];
  const sequence = kind === 'random' ? randomSequence(rng, length) : patternedSequence(rng, length);
  current = { kind, practice: false, ...sequence };
  $('run-heading').textContent = 'Real tries';
  $('run-progress').textContent = `Try ${tries.length + 1}: ${length} digits`;
  present();
}

function present() {
  state = 'showing';
  $('answer').hidden = true;
  $('stage').hidden = false;
  setStage('', 'Get ready...');
  const step = DIGIT_ON_MS + DIGIT_OFF_MS;
  later(() => setStage(''), READY_MS);
  [...current.digits].forEach((d, i) => {
    later(() => setStage(d), READY_MS + i * step);
    later(() => setStage(''), READY_MS + i * step + DIGIT_ON_MS);
  });
  later(startTyping, READY_MS + current.digits.length * step);
}

function startTyping() {
  state = 'typing';
  typed = '';
  $('typed').textContent = '';
  $('stage').hidden = true;
  $('answer').hidden = false;
  $('answer-prompt').focus();
}

function press(key) {
  if (state !== 'typing' || paused) return;
  if (key === 'Enter') {
    submit();
    return;
  }
  if (key === 'Backspace') typed = typed.slice(0, -1);
  else if (/^\d$/.test(key) && typed.length < MAX_TYPED) typed += key;
  $('typed').textContent = spaced(typed);
}

function submit() {
  state = 'feedback';
  const correct = typed === current.digits;
  if (current.practice) {
    practiceLeft--;
  } else {
    tries.push({ kind: current.kind, digits: current.digits, chunks: current.chunks, correct });
    tracks[current.kind] = recordTry(tracks[current.kind], correct);
    lastKind = current.kind;
  }
  let message = correct ? 'Correct!' : 'Not this time.';
  if (current.practice && !correct) message = `Not quite. It was ${spaced(current.digits)}.`;
  const finishedPractice = current.practice && practiceLeft === 0;
  current = null;

  $('answer').hidden = true;
  $('stage').hidden = false;
  $('run-heading').focus();
  setStage(message, '', true);
  announce(message);
  if (finishedPractice) {
    later(() => {
      const intro = 'Practice done! Now the real tries. They start at 4 digits.';
      setStage(intro, '', true);
      announce(intro);
      later(nextTry, INTRO_MS);
    }, FEEDBACK_MS);
  } else {
    later(nextTry, FEEDBACK_MS);
  }
}

function pause() {
  if (state === 'idle' || paused) return;
  paused = true;
  clearTimers();
  current = null; // the string in progress is thrown out
  setPaused(true, 'play-area');
}

function resume() {
  paused = false;
  setPaused(false, 'play-area');
  $('run-heading').focus();
  nextTry(); // a fresh string of the same kind and length
}

function reset() {
  clearTimers();
  state = 'idle';
  paused = false;
  current = null;
  spans = null;
  setPaused(false, 'play-area');
  $('stage').hidden = false;
  $('answer').hidden = true;
  clearCopyBoxes();
  showOnly(['intro-body']);
  $('intro-heading').focus();
}

// ---------- Results: the reveal ----------

function showResults() {
  state = 'idle';
  spans = { random: tracks.random.span, patterned: tracks.patterned.span };
  fill('random-span', spanText(spans.random));
  fill('patterned-span', spanText(spans.patterned));
  // A random span of 0 means "under 4", so count from 3 and say "at least".
  const diff = spans.patterned - (spans.random || 3);
  fill('span-diff', `${spans.random ? '' : 'at least '}${diff} ${diff === 1 ? 'digit' : 'digits'}`);
  const outcome = compareSpans(spans);
  for (const el of document.querySelectorAll('[data-outcome]')) el.hidden = el.dataset.outcome !== outcome;

  const example = revealExample(tries);
  $('example').hidden = !example;
  if (example) {
    for (const el of document.querySelectorAll('[data-ex]')) el.hidden = (el.dataset.ex === 'right') !== example.wasCorrect;
    const row = $('chunk-row');
    row.replaceChildren();
    example.chunks.forEach((chunk, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'chunk-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '|';
        row.append(sep);
      }
      const span = document.createElement('span');
      span.className = 'chunk';
      span.textContent = chunk;
      row.append(span);
    });
    fill('ex-digits', example.digits.length);
    const n = example.chunks.length;
    fill('ex-chunks', `${n} ${n === 1 ? 'thing' : 'things'}`);
  }

  showOnly(['results', 'explain', 'talk', 'deeper']);
  const label = (v) => (v > 0 ? `${v} digits` : 'under 4');
  drawBars($('span-bars'), [
    { label: 'Random', value: spans.random, cls: 'bar-a' },
    { label: 'Patterned', value: spans.patterned, cls: 'bar-b' },
  ], `Your span for random strings, ${label(spans.random)}, and for patterned strings, ${label(spans.patterned)}`, label);
  $('results-heading').focus();
  announce('Done! Here are your results.');
}

// ---------- Input ----------

const running = () => !$('run').hidden && !paused;

document.addEventListener('keydown', (event) => {
  if (!running()) return;
  if (event.key === 'Escape') {
    pause();
    return;
  }
  if (state !== 'typing') return;
  if (/^\d$/.test(event.key) || event.key === 'Backspace' || event.key === 'Enter') {
    event.preventDefault(); // also stops Enter from clicking a focused keypad button twice
    press(event.key);
  }
});

for (const button of document.querySelectorAll('.key-btn')) {
  button.addEventListener('click', () => press(button.dataset.key));
}

onTabHidden(pause);

$('start').addEventListener('click', start);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', reset);
$('again').addEventListener('click', reset);
document.querySelector('.copy-btn').addEventListener('click', (event) => {
  copyResults(event.currentTarget, memorySummaryText(spans));
});
