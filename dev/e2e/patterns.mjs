// Pattern memory run-through.
import {
  open, close, check, note, sleep, runAxe, noSideScroll, isVisible, waitVisible, text, setHidden, screenshot,
} from './helpers.mjs';
import { activate, tabTo, copiedText } from './common.mjs';
import { STRUCTURED, SIZE } from '../../js/patterns-logic.js';

const isShape = (cells) => STRUCTURED.some((s) => s.cells.join() === cells.join());

async function readShown(page) {
  return page.$$eval('#grid .cell', (els) => els.map((e, i) => (e.classList.contains('filled') ? i : -1)).filter((i) => i >= 0));
}

// Fills the chosen cells by keyboard (arrows and Space), touch, or mouse.
async function fillCells(page, targets, how) {
  if (how !== 'key') {
    for (const i of targets) {
      const el = (await page.$$('#grid .cell'))[i];
      if (how === 'touch') await el.tap();
      else await el.click();
    }
    return;
  }
  for (const i of targets) {
    const at = await page.evaluate(() => [...document.querySelectorAll('#grid .cell')].indexOf(document.activeElement));
    const [r0, c0] = [Math.floor(at / SIZE), at % SIZE];
    const [r1, c1] = [Math.floor(i / SIZE), i % SIZE];
    for (let k = 0; k < Math.abs(r1 - r0); k++) await page.keyboard.press(r1 > r0 ? 'ArrowDown' : 'ArrowUp');
    for (let k = 0; k < Math.abs(c1 - c0); k++) await page.keyboard.press(c1 > c0 ? 'ArrowRight' : 'ArrowLeft');
    await page.keyboard.press('Space');
  }
}

// Plays every grid. Shapes are rebuilt perfectly; random grids only partly
// (plus one wrong square) when `chunkEffect` is on.
async function play(page, how, { chunkEffect = true, tabSwitchOnce = false, checkReducedMotion = false } = {}) {
  let done = 0;
  let didSwitch = !tabSwitchOnce;
  const deadline = Date.now() + 300000;
  while (!(await isVisible(page, '#results'))) {
    if (Date.now() > deadline) {
      check(false, 'patterns: run did not finish in time');
      return done;
    }
    await page.waitForFunction(() => document.querySelector('#grid').classList.contains('showing'), { timeout: 10000 });
    const shown = await readShown(page);
    if (checkReducedMotion) {
      const anim = await page.$eval('#timer-bar .timer-fill', (el) => getComputedStyle(el).animationName);
      check(anim === 'none', `patterns: reduced motion should stop the timer animation (got ${anim})`);
    }
    if (!didSwitch && done === 1) {
      didSwitch = true;
      await sleep(1000);
      await setHidden(page, true);
      await sleep(150);
      check(await isVisible(page, '#paused'), 'patterns: tab switch during the 5 seconds should pause');
      await setHidden(page, false);
      await activate(page, '#resume', how);
      continue;
    }
    await waitVisible(page, '#check', 8000);
    let targets = shown;
    if (chunkEffect && !isShape(shown)) {
      const keep = shown.slice(0, Math.ceil(shown.length * 0.6));
      const wrong = [...Array(36).keys()].find((i) => !shown.includes(i));
      targets = [...keep, wrong];
    }
    await fillCells(page, targets, how);
    if (how === 'key') {
      await page.keyboard.press('Tab');
      check(await page.evaluate(() => document.activeElement.id === 'check'), 'patterns: Tab from the grid should reach Check');
      if (done === 0) await runAxe(page, 'patterns rebuild');
      await page.keyboard.press('Enter');
    } else {
      await activate(page, '#check', how);
    }
    await waitVisible(page, '#next');
    if (done === 0) await screenshot(page, `patterns-feedback-${how}`);
    check(/You got \d+ of \d+ squares/.test(await text(page, '#trial-score')), 'patterns: score message missing');
    await activate(page, '#next', how);
    done++;
  }
  return done;
}

async function checkResults(page, label, expectOutcome) {
  const body = await page.evaluate(() => document.body.innerText);
  check(!/NaN|undefined/.test(body), `${label}: page shows NaN or undefined`);
  const shown = await page.$$eval('[data-outcome]', (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.outcome));
  note(`${label}: shapes ${await text(page, '#results [data-fill="structured"]')}%, random ${await text(page, '#results [data-fill="random"]')}%, outcome ${shown.join(', ')}`);
  if (expectOutcome) check(shown.includes(expectOutcome), `${label}: expected ${expectOutcome}`);
  check(await page.$eval('#pattern-bars svg', (svg) => svg.querySelectorAll('rect').length === 2), `${label}: bars missing`);
  check(await page.evaluate(() => document.activeElement.id === 'results-heading'), `${label}: focus should be on results heading`);
}

export default async function () {
  // Run A: keyboard only, desktop, shapes remembered better.
  {
    const s = await open('patterns/');
    const { page } = s;
    await runAxe(page, 'patterns intro');
    check(await tabTo(page, '#start'), 'patterns keyboard: could not Tab to Start');
    await page.keyboard.press('Enter');
    await waitVisible(page, '#run');
    const n = await play(page, 'key', { tabSwitchOnce: true });
    note(`patterns keyboard: ${n} grids`);
    await checkResults(page, 'patterns keyboard', 'chunking');
    await runAxe(page, 'patterns results');
    await activate(page, '#results .copy-btn', 'key');
    const copied = await copiedText(page, '#results .copy-box');
    note(`copied: ${copied}`);
    check(copied.startsWith('Pattern memory: structured grids'), 'patterns copy text wrong');
    await screenshot(page, 'patterns-desktop-results');
    await activate(page, '#again', 'key');
    check(await isVisible(page, '#start'), 'patterns: Try it again should show Start');
    await close(s, 'patterns keyboard');
    note(`page weight: ${(s.log.bytes / 1024).toFixed(1)} KB`);
    check(s.log.bytes < 150 * 1024, `patterns page weight ${s.log.bytes} over 150 KB`);
  }

  // Run B: touch at phone width, everything perfect (no difference).
  {
    const s = await open('patterns/', { width: 360, height: 740, touch: true });
    const { page } = s;
    await noSideScroll(page, 'patterns phone intro');
    await activate(page, '#start', 'touch');
    await noSideScroll(page, 'patterns phone run');
    await play(page, 'touch', { chunkEffect: false });
    await checkResults(page, 'patterns touch', 'same');
    await noSideScroll(page, 'patterns phone results');
    await close(s, 'patterns touch');
  }

  // Run C: mouse at 200% zoom with reduced motion.
  {
    const s = await open('patterns/', { width: 683, height: 384, scale: 2, reducedMotion: true });
    const { page } = s;
    await activate(page, '#start', 'mouse');
    await play(page, 'mouse', { checkReducedMotion: true });
    await checkResults(page, 'patterns mouse', 'chunking');
    await noSideScroll(page, 'patterns zoom results');
    await close(s, 'patterns mouse');
  }
}
