// Stroop test: page logic.
// Each try: a fixation cross for 500 ms, then the word (or digits) until the
// student answers or 3 seconds pass. Response times use event.timeStamp from
// pointerdown or keydown, measured from the frame after the word appeared.

import {
  buildTrials, digitDisplay, scoreStroop, stroopSummaryText, COLORS, PRACTICE, TRIALS, FIXATION_MS, TIMEOUT_MS,
} from './stroop-logic.js';
import { mulberry32, seedFromClock } from './lib/random.js';
import { $, showOnly as showSections, announce, fill, copyResults, clearCopyBoxes, onTabHidden } from './lib/page.js';
import { GUESS_MS, showOnNextFrame } from './lib/timing.js';
import { drawBars } from './lib/charts.js';

const rng = mulberry32(seedFromClock());
const SECTIONS = ['intro-body', 'run', 'results', 'explain', 'talk', 'deeper'];
const FEEDBACK_MS = 1100; // practice feedback stays up this long
const GAP_MS = 400; // blank screen between real tries
const TIMES_UP_MS = 700;
const TOO_SOON_MS = 1400;
const BLOCK_INTRO_MS = 2200;

const stimulus = $('stimulus');
let version = 'colors';
let block = null; // { trials, index, practice, results, onDone }
let trial = null; // the current try plus its onset time
let timer = 0;
let cancelFrame = () => {};
let paused = false;
let score = null;

const showOnly = (ids) => showSections(SECTIONS, ids);

function setVersion(v) {
  version = v;
  for (const el of document.querySelectorAll('[data-v]')) el.hidden = el.dataset.v !== v;
  $('switch-version').textContent = v === 'colors' ? 'Try the numbers version' : 'Switch back to colors';
}

function showMessage(text, kind = 'message') {
  stimulus.className = `stimulus ${kind}`;
  stimulus.textContent = text;
}

function drawStimulus(t) {
  if (version === 'colors') {
    stimulus.className = `stimulus ink-${t.ink}`;
    stimulus.textContent = COLORS[t.word];
  } else {
    stimulus.className = 'stimulus';
    stimulus.textContent = digitDisplay(t);
  }
}

function rightAnswer(t) {
  if (version === 'colors') return `The ink was ${COLORS[t.ink]}.`;
  return t.ink === 0 ? 'There was 1 digit.' : `There were ${t.ink + 1} digits.`;
}

// ---------- Running tries ----------

function startBlock({ trials, practice, heading, onDone, intro = '' }) {
  block = { trials, index: 0, practice, results: [], onDone };
  $('run-heading').textContent = heading;
  if (intro) {
    showMessage(intro);
    announce(intro);
    timer = setTimeout(next, BLOCK_INTRO_MS);
  } else {
    next();
  }
}

function next() {
  if (block.index < block.trials.length) {
    startTrial();
    return;
  }
  const done = block;
  block = null;
  done.onDone(done.results);
}

function startTrial() {
  const t = block.trials[block.index];
  trial = { ...t, onset: null };
  $('run-progress').textContent = `${block.practice ? 'Practice try' : 'Try'} ${block.index + 1} of ${block.trials.length}`;
  showMessage('+', 'fixation');
  timer = setTimeout(() => {
    cancelFrame = showOnNextFrame(() => drawStimulus(t), (time) => {
      if (!trial) return;
      trial.onset = time;
      timer = setTimeout(() => finishTrial(false, null), TIMEOUT_MS);
    });
  }, FIXATION_MS);
}

function cancelTimers() {
  clearTimeout(timer);
  cancelFrame();
}

function respond(answer, timeStamp) {
  if (!trial || paused) return;
  // No onset yet means the press came during the fixation cross.
  const rt = trial.onset === null ? -1 : timeStamp - trial.onset;
  if (rt < GUESS_MS) tooSoon();
  else finishTrial(answer === trial.ink, rt);
}

function tooSoon() {
  cancelTimers();
  trial = null;
  showMessage(version === 'colors' ? 'Too soon! Wait for the word.' : 'Too soon! Wait for the digits.');
  announce('Too soon.');
  timer = setTimeout(startTrial, TOO_SOON_MS); // the same try again
}

// rt is null when the try timed out.
function finishTrial(correct, rt) {
  cancelTimers();
  const t = trial;
  trial = null;
  if (!block.practice) block.results.push({ type: t.type, correct, rt });
  block.index++;
  if (block.practice) {
    const text = rt === null ? `Time's up! ${rightAnswer(t)}` : correct ? 'Correct!' : `Oops! ${rightAnswer(t)}`;
    showMessage(text);
    announce(text);
    timer = setTimeout(next, FEEDBACK_MS);
  } else if (rt === null) {
    showMessage("Time's up!");
    timer = setTimeout(next, TIMES_UP_MS);
  } else {
    showMessage('');
    timer = setTimeout(next, GAP_MS);
  }
}

function pause() {
  if (!block || paused) return;
  paused = true;
  cancelTimers();
  trial = null; // the try in progress is thrown out
  $('stage').hidden = true;
  $('paused').hidden = false;
  $('pause').hidden = true;
  $('paused-heading').focus();
  announce('Paused');
}

function resume() {
  paused = false;
  $('stage').hidden = false;
  $('paused').hidden = true;
  $('pause').hidden = false;
  $('run-heading').focus();
  next();
}

function reset() {
  cancelTimers();
  block = null;
  trial = null;
  paused = false;
  score = null;
  $('stage').hidden = false;
  $('paused').hidden = true;
  $('pause').hidden = false;
  clearCopyBoxes();
  showOnly(['intro-body']);
  $('intro-heading').focus();
}

function start() {
  showOnly(['run']);
  $('run-heading').focus();
  startBlock({
    trials: buildTrials(rng, PRACTICE),
    practice: true,
    heading: 'Practice',
    onDone: () => startBlock({
      trials: buildTrials(rng, TRIALS),
      practice: false,
      heading: 'Real tries',
      intro: 'Practice done! Now 40 real tries.',
      onDone: showResults,
    }),
  });
}

// ---------- Results ----------

function showResults(results) {
  score = scoreStroop(results);
  const ms = (v) => (Number.isFinite(v) ? `${Math.round(v)} ms` : 'none');
  fill('match', ms(score.match.average));
  fill('mismatch', ms(score.mismatch.average));
  fill('effect', ms(score.effect));
  fill('effect-num', Number.isFinite(score.effect) ? Math.round(Math.abs(score.effect)) : 0);
  fill('match-mistakes', score.match.mistakes);
  fill('mismatch-mistakes', score.mismatch.mistakes);
  $('mistake-note').hidden = !(score.mismatch.mistakes > score.match.mistakes);
  const noEffect = score.outcome === 'same' || score.outcome === 'reversed';
  for (const el of document.querySelectorAll('[data-outcome]')) {
    const tag = el.dataset.outcome;
    el.hidden = tag === 'no-effect' ? !noEffect : tag !== score.outcome;
  }

  showOnly(['results', 'explain', 'talk', 'deeper']);
  drawBars($('stroop-bars'), [
    { label: 'Matching', value: score.match.average || 0, cls: 'bar-a' },
    { label: 'Mismatching', value: score.mismatch.average || 0, cls: 'bar-b' },
  ], `Average time for matching tries, ${ms(score.match.average)}, and mismatching tries, ${ms(score.mismatch.average)}`,
  (v) => (v ? `${Math.round(v)} ms` : 'none'));
  $('results-heading').focus();
  announce('Done! Here are your results.');
}

// ---------- Input ----------

const running = () => !$('run').hidden && !paused;

for (const button of document.querySelectorAll('.answer')) {
  button.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button > 0) return;
    event.preventDefault(); // no focus change or text selection
    respond(Number(button.dataset.answer), event.timeStamp);
  });
}

document.addEventListener('keydown', (event) => {
  if (!running()) return;
  if (event.key === 'Escape') {
    pause();
    return;
  }
  let answer = ['1', '2', '3', '4'].indexOf(event.key);
  // Enter or Space on a focused answer button also answers.
  const focused = document.activeElement;
  if (answer < 0 && (event.key === 'Enter' || event.key === ' ') && focused.classList.contains('answer')) {
    answer = Number(focused.dataset.answer);
  }
  if (answer < 0) return;
  event.preventDefault();
  if (!event.repeat) respond(answer, event.timeStamp);
});

onTabHidden(pause);

$('switch-version').addEventListener('click', () => setVersion(version === 'colors' ? 'numbers' : 'colors'));
$('start').addEventListener('click', start);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', reset);
$('again').addEventListener('click', reset);
document.querySelector('.copy-btn').addEventListener('click', (event) => {
  copyResults(event.currentTarget, stroopSummaryText(version, score));
});
