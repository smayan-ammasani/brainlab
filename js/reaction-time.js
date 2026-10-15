// Reaction time experiment: page logic.
// Timing rules (dev/SPEC.md section 4): responses are timed from pointerdown
// or keydown using event.timeStamp, the visual onset is the timestamp of the
// animation frame after the screen changed, and a sound's onset comes from the
// AudioContext clock mapped onto the same performance.now() timeline.

import {
  randomWait, classifyResponse, summarize, pathwaySegments, audioTimeToPerf,
  alternatingKinds, compareSenses, sightSummaryText, senseSummaryText, axisFor,
} from './reaction-time-logic.js';
import { mulberry32, seedFromClock } from './lib/random.js';
import { $, showOnly as showSections, announce, fill, copyResults, clearCopyBoxes, onTabHidden } from './lib/page.js';
import { showOnNextFrame } from './lib/timing.js';
import { svgEl, newChart, drawBars } from './lib/charts.js';

const rng = mulberry32(seedFromClock());

const SIGHT_PRACTICE = 3;
const SIGHT_TRIALS = 10;
const TWIST_PRACTICE = 2;
const TWIST_TRIALS = 12;
const FEEDBACK_MS = 1200; // how long the time stays on screen after a try
const TOO_SOON_MS = 1600; // how long "Too soon!" stays up before the redo
const BLOCK_INTRO_MS = 2200; // pause before the first real try
const NO_BEEP_HINT_MS = 4000; // hint if nobody responds this long after a beep
const TYPICAL = { sight: 331, sound: 284 }; // Shelton and Kumar (2010), see dev/sources.md RT-12

const SECTIONS = ['intro-body', 'run', 'results', 'explain', 'twist', 'twist-results', 'talk', 'deeper'];
const stage = $('stage');

let block = null; // the current run of tries: { kinds, index, practice, results, onDone, showCue }
let trial = null; // the current try: { kind, onset, toneAt, tone }
let timer = 0;
let hintTimer = 0;
let cancelFrame = () => {};
let paused = false;
let audio = null;
let sightSummary = null;
let senses = null; // { sight, sound } summaries from the bonus round

const showOnly = (ids) => showSections(SECTIONS, ids);

function setStage({ go = false, text = '', sub = '', cue = null }) {
  stage.classList.toggle('go', go);
  $('go-shape').hidden = !go;
  $('cue-eye').hidden = cue !== 'sight';
  $('cue-ear').hidden = cue !== 'sound';
  $('stage-text').textContent = text;
  $('stage-sub').textContent = sub;
}

// ---------- Sound ----------

function ensureAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  // Browsers only allow audio after the user interacts, so this runs inside a click handler.
  if (!audio) audio = new Ctx();
  if (audio.state === 'suspended') audio.resume();
  return true;
}

// Plays a 100 ms, 1000 Hz tone at an exact AudioContext time (seconds).
// A 5 ms fade in and out keeps it from clicking.
function playTone(when) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = 1000;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.3, when + 0.005);
  gain.gain.setValueAtTime(0.3, when + 0.095);
  gain.gain.linearRampToValueAtTime(0, when + 0.1);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(when);
  osc.stop(when + 0.1);
  return osc;
}

function silence(osc) {
  try { osc.stop(); } catch (e) { /* already stopped */ }
  osc.disconnect();
}

// When the scheduled tone reaches the speaker, on the performance.now() timeline.
function toneOnset(when) {
  const ts = audio.getOutputTimestamp ? audio.getOutputTimestamp() : {};
  return audioTimeToPerf({
    when,
    contextTime: ts.contextTime,
    performanceTime: ts.performanceTime,
    currentTime: audio.currentTime,
    now: performance.now(),
    outputLatency: audio.outputLatency,
  });
}

const roughAudio = () => !audio.getOutputTimestamp && !('outputLatency' in audio);

// ---------- Running tries ----------

function startBlock({ kinds, practice, heading, onDone, showCue = false, intro = '' }) {
  block = { kinds, index: 0, practice, results: [], onDone, showCue };
  $('run-heading').textContent = heading;
  if (intro) {
    setStage({ text: intro });
    announce(intro);
    timer = setTimeout(next, BLOCK_INTRO_MS);
  } else {
    next();
  }
}

function next() {
  if (block.index < block.kinds.length) {
    startTrial();
    return;
  }
  const done = block;
  block = null;
  done.onDone(done.results);
}

function startTrial() {
  const kind = block.kinds[block.index];
  trial = { kind, onset: null, toneAt: 0, tone: null };
  $('run-progress').textContent = `${block.practice ? 'Practice try' : 'Try'} ${block.index + 1} of ${block.kinds.length}`;
  const cue = block.showCue ? kind : null;
  let text = 'Wait for it...';
  if (kind === 'sound') text = 'Listen for the beep...';
  else if (block.showCue) text = 'Watch for the change...';
  setStage({ text, cue });

  const wait = randomWait(rng);
  if (kind === 'sight') {
    timer = setTimeout(() => {
      cancelFrame = showOnNextFrame(
        () => setStage({ go: true, text: 'NOW!' }),
        (t) => { if (trial) trial.onset = t; },
      );
    }, wait);
  } else {
    // The screen does not change for a sound try, so only the beep can be the signal.
    trial.toneAt = audio.currentTime + wait / 1000;
    trial.tone = playTone(trial.toneAt);
    hintTimer = setTimeout(() => {
      setStage({ text, cue, sub: 'No beep? Check that your sound is on, or press Pause.' });
    }, wait + NO_BEEP_HINT_MS);
  }
}

function cancelTimers() {
  clearTimeout(timer);
  clearTimeout(hintTimer);
  cancelFrame();
  if (trial && trial.tone) silence(trial.tone);
}

function respond(timeStamp) {
  if (!trial || paused) return;
  let rt;
  if (trial.kind === 'sight') {
    // No onset yet means the press came before the change was on screen.
    rt = trial.onset === null ? -1 : timeStamp - trial.onset;
  } else {
    rt = timeStamp - toneOnset(trial.toneAt);
  }
  if (classifyResponse(rt) === 'too-soon') tooSoon();
  else finishTrial(rt);
}

function tooSoon() {
  cancelTimers();
  trial = null;
  setStage({ text: 'Too soon! Wait for it.' });
  announce('Too soon. Wait for it.');
  timer = setTimeout(startTrial, TOO_SOON_MS); // the same try again
}

function finishTrial(rt) {
  cancelTimers();
  const { kind } = trial;
  trial = null;
  const lapse = classifyResponse(rt) === 'lapse';
  if (!block.practice) block.results.push({ kind, rt });
  const text = `${Math.round(rt)} ms`;
  let sub = block.practice ? 'Practice' : '';
  if (lapse) sub = 'A slow one. It will be left out of your average.';
  setStage({ text, sub });
  announce(text);
  block.index++;
  timer = setTimeout(next, FEEDBACK_MS);
}

function pause() {
  if (!block || paused) return;
  paused = true;
  cancelTimers();
  trial = null; // the try in progress is thrown out
  stage.hidden = true;
  $('paused').hidden = false;
  $('pause').hidden = true;
  $('paused-heading').focus();
  announce('Paused');
}

function resume() {
  paused = false;
  stage.hidden = false;
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
  sightSummary = null;
  senses = null;
  stage.hidden = false;
  $('paused').hidden = true;
  $('pause').hidden = false;
  clearCopyBoxes();
  showOnly(['intro-body']);
  $('intro-heading').focus();
}

// ---------- Round 1: sight ----------

function startSight() {
  showOnly(['run']);
  $('run-heading').focus();
  startBlock({
    kinds: Array(SIGHT_PRACTICE).fill('sight'),
    practice: true,
    heading: 'Practice',
    onDone: () => startBlock({
      kinds: Array(SIGHT_TRIALS).fill('sight'),
      practice: false,
      heading: 'Round 1: Sight',
      intro: `Practice done! Now ${SIGHT_TRIALS} real tries.`,
      onDone: sightDone,
    }),
  });
}

function sightDone(results) {
  const times = results.map((r) => r.rt);
  sightSummary = summarize(times);
  const avg = sightSummary.average;
  fill('avg', Math.round(avg));
  fill('fastest', Math.round(sightSummary.fastest));
  fill('spread', Math.round(sightSummary.spread));
  fill('times', times.map((t) => `${Math.round(t)} ms`).join(', '));
  fill('avg-words', avg < 500 ? 'less than half a second' : avg < 1000 ? 'less than one second' : 'more than one second');
  fill('rest', Math.round(pathwaySegments(avg)[2].ms));
  $('lapse-note').hidden = sightSummary.lapses === 0;

  showOnly(['results', 'explain', 'twist', 'talk', 'deeper']);
  drawDotPlot($('dot-plot'), times, avg);
  drawSplitBar($('split-bar'), avg);
  $('results-heading').focus();
  announce('Done! Here are your results.');
}

// ---------- Round 2: sight versus sound ----------

function startTwist() {
  if (!ensureAudio()) {
    $('no-audio').hidden = false;
    return;
  }
  showOnly(['run']);
  $('run-heading').focus();
  startBlock({
    kinds: alternatingKinds(TWIST_PRACTICE),
    practice: true,
    heading: 'Bonus round: practice',
    showCue: true,
    onDone: () => startBlock({
      kinds: alternatingKinds(TWIST_TRIALS),
      practice: false,
      heading: 'Bonus round: sight vs. sound',
      showCue: true,
      intro: `Practice done! Now ${TWIST_TRIALS} real tries.`,
      onDone: twistDone,
    }),
  });
}

function twistDone(results) {
  const times = (kind) => results.filter((r) => r.kind === kind).map((r) => r.rt);
  senses = { sight: summarize(times('sight')), sound: summarize(times('sound')) };
  showTwistResults(true);
  $('rough-audio').hidden = !roughAudio();
}

function showTwistResults(measured) {
  const sight = measured ? senses.sight.average : TYPICAL.sight;
  const sound = measured ? senses.sound.average : TYPICAL.sound;
  const { difference, outcome } = compareSenses(sight, sound);
  for (const el of document.querySelectorAll('[data-outcome]')) {
    const tag = el.dataset.outcome;
    let visible = measured && tag === outcome;
    if (tag === 'skipped') visible = !measured;
    if (tag === 'measured') visible = measured;
    if (tag === 'not-faster') visible = measured && outcome !== 'sound-faster';
    el.hidden = !visible;
  }
  fill('diff', Math.round(Math.abs(difference)));
  $('twist-results-heading').textContent = measured ? 'Sight versus sound: your results' : 'Sight versus sound: typical results';
  $('rough-audio').hidden = true;
  $('start-twist').textContent = measured ? 'Do the bonus round again' : 'Start the bonus round';
  showOnly(['results', 'explain', 'twist', 'twist-results', 'talk', 'deeper']);
  drawBars($('sense-bars'), [
    { label: 'Sight', value: sight, cls: 'bar-sight' },
    { label: 'Sound', value: sound, cls: 'bar-sound' },
  ], measured ? 'Your average reaction times for sight and sound' : 'Typical average reaction times for sight and sound from one study');
  $('twist-results-heading').focus();
  announce(measured ? 'Done! Here are your sight and sound results.' : 'Here are typical results.');
}

// ---------- Charts ----------

function drawDotPlot(container, times, average) {
  const height = 150;
  const baseline = 104;
  const { min, max, ticks } = axisFor([...times, average]);
  const { svg, width } = newChart(container, height,
    `Dot plot of your ${times.length} tries. Your average was ${Math.round(average)} ms.`);
  const pad = 26;
  const x = (v) => pad + ((v - min) / (max - min)) * (width - 2 * pad);

  svg.append(svgEl('line', { x1: pad, y1: baseline + 10, x2: width - pad, y2: baseline + 10, class: 'axis' }));
  for (const t of ticks) {
    svg.append(svgEl('line', { x1: x(t), y1: baseline + 10, x2: x(t), y2: baseline + 16, class: 'axis' }));
    svg.append(svgEl('text', { x: x(t), y: baseline + 34, class: 'tick' }, t === ticks[ticks.length - 1] ? `${t} ms` : `${t}`));
  }

  // Stack dots that would overlap.
  const levels = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    const cx = x(t);
    let level = 0;
    while ((levels[level] || []).some((other) => Math.abs(other - cx) < 15)) level++;
    (levels[level] = levels[level] || []).push(cx);
    const lapse = classifyResponse(t) === 'lapse';
    svg.append(svgEl('circle', { cx, cy: baseline - level * 16, r: 7, class: lapse ? 'dot dot-lapse' : 'dot' }));
  }

  const ax = x(average);
  svg.append(svgEl('line', { x1: ax, y1: 26, x2: ax, y2: baseline + 10, class: 'avg-line' }));
  const anchor = ax < 70 ? 'start' : ax > width - 70 ? 'end' : 'middle';
  svg.append(svgEl('text', { x: ax, y: 18, class: 'avg-label', 'text-anchor': anchor }, `average ${Math.round(average)} ms`));
}

function drawSplitBar(container, average) {
  const segs = pathwaySegments(average);
  const { svg, width } = newChart(container, 92,
    `Your ${Math.round(average)} ms split into three parts: about 60 ms from eye to the vision area, about 22 ms from brain to hand muscles, and about ${Math.round(segs[2].ms)} ms for everything else.`);
  const pad = 12;
  const scale = (width - 2 * pad) / segs.reduce((sum, s) => sum + s.ms, 0);
  let left = pad;
  segs.forEach((s, i) => {
    const w = s.ms * scale;
    svg.append(svgEl('rect', { x: left, y: 14, width: Math.max(w - 2, 1), height: 40, class: `seg seg-${s.id}` }));
    if (w > 22) svg.append(svgEl('text', { x: left + w / 2, y: 35, class: 'seg-num' }, `${i + 1}`));
    left += w;
  });
  svg.append(svgEl('text', { x: pad, y: 78, class: 'tick', 'text-anchor': 'start' }, '0 ms'));
  svg.append(svgEl('text', { x: width - pad, y: 78, class: 'tick', 'text-anchor': 'end' }, `${Math.round(average)} ms`));
}

// ---------- Input ----------

const running = () => !$('run').hidden && !paused;

stage.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button > 0) return;
  event.preventDefault(); // no text selection or focus change
  respond(event.timeStamp);
});

document.addEventListener('keydown', (event) => {
  if (!running()) return;
  if (event.key === 'Escape') {
    pause();
  } else if (event.code === 'Space' || event.key === ' ') {
    event.preventDefault(); // keep Space from scrolling or pressing a focused button
    if (!event.repeat) respond(event.timeStamp);
  }
});

document.addEventListener('keyup', (event) => {
  if (running() && (event.code === 'Space' || event.key === ' ')) event.preventDefault();
});

onTabHidden(pause);

$('start').addEventListener('click', startSight);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', reset);
$('again').addEventListener('click', reset);
$('start-twist').addEventListener('click', startTwist);
$('skip-twist').addEventListener('click', () => showTwistResults(false));
$('test-sound').addEventListener('click', () => {
  if (ensureAudio()) playTone(audio.currentTime + 0.05);
  else $('no-audio').hidden = false;
});
for (const button of document.querySelectorAll('.copy-btn')) {
  button.addEventListener('click', () => copyResults(button, button.dataset.copy === 'sight'
    ? sightSummaryText(sightSummary)
    : senseSummaryText(senses.sight, senses.sound)));
}
