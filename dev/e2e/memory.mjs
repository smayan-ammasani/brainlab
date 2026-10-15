// Working memory run-through.
import {
  open, close, check, note, sleep, runAxe, noSideScroll, isVisible, waitVisible, text, setHidden, screenshot,
} from './helpers.mjs';
import { activate, tabTo, copiedText } from './common.mjs';
import { POOL } from '../../js/memory-logic.js';

const FAMILIAR = POOL.filter((c) => c.length >= 3);

// Writes down every digit the page flashes, like a student watching closely.
function watchDigits() {
  window.__seen = [];
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('digit');
    new MutationObserver(() => {
      if (/^\d$/.test(el.textContent)) window.__seen.push(el.textContent);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
}

// Types an answer by keyboard, or by tapping or clicking the on-screen keypad.
async function typeAnswer(page, digits, how) {
  if (how === 'key') {
    await page.keyboard.type(digits, { delay: 30 });
    await page.keyboard.press('Enter');
    return;
  }
  for (const d of [...digits, 'Enter']) {
    const el = await page.$(`.key-btn[data-key="${d}"]`);
    if (how === 'touch') await el.tap();
    else await el.click();
  }
}

// Plays until results. Answers right while the string is no longer than the
// limit for its (guessed) kind, then answers wrong.
async function play(page, how, { randomLimit, patternedLimit, tabSwitchOnce = false, pauseWhileTyping = false }) {
  let answered = 0;
  let didSwitch = !tabSwitchOnce;
  let didPause = !pauseWhileTyping;
  const deadline = Date.now() + 400000;
  while (!(await isVisible(page, '#results'))) {
    if (Date.now() > deadline) {
      check(false, 'memory: run did not finish in time');
      return answered;
    }
    if (await isVisible(page, '#paused')) {
      await sleep(100);
      continue;
    }
    const seen = await page.evaluate(() => window.__seen.length);
    if (!didSwitch && answered === 3 && seen >= 2 && !(await isVisible(page, '#answer'))) {
      didSwitch = true;
      await setHidden(page, true);
      await sleep(150);
      check(await isVisible(page, '#paused'), 'memory: tab switch should pause');
      await setHidden(page, false);
      await page.evaluate(() => { window.__seen = []; });
      await activate(page, '#resume', how);
      continue;
    }
    if (await isVisible(page, '#answer')) {
      const digits = await page.evaluate(() => window.__seen.join(''));
      if (!didPause && answered === 4) {
        didPause = true;
        await page.keyboard.press('Escape');
        await sleep(150);
        check(await isVisible(page, '#paused'), 'memory: Esc while typing should pause');
        await page.evaluate(() => { window.__seen = []; });
        await activate(page, '#resume', how);
        continue;
      }
      const patterned = FAMILIAR.some((c) => digits.includes(c));
      const limit = patterned ? patternedLimit : randomLimit;
      const answer = digits.length <= limit ? digits : `${digits.slice(0, -1)}${(Number(digits.slice(-1)) + 1) % 10}`;
      await page.evaluate(() => { window.__seen = []; });
      await typeAnswer(page, answer, how);
      answered++;
      await sleep(300);
      continue;
    }
    await sleep(60);
  }
  return answered;
}

async function checkResults(page, label) {
  const body = await page.evaluate(() => document.body.innerText);
  check(!/NaN|undefined/.test(body), `${label}: page shows NaN or undefined`);
  const shown = await page.$$eval('[data-outcome]', (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.outcome));
  const random = await text(page, '[data-fill="random-span"]');
  const patterned = await text(page, '[data-fill="patterned-span"]');
  note(`${label}: random span ${random}, patterned span ${patterned}, outcome ${shown.join(', ')}`);
  check(shown.length === 1, `${label}: exactly one outcome message should show`);
  check(await page.$eval('#span-bars svg', (svg) => svg.querySelectorAll('rect').length === 2), `${label}: bars missing`);
  check(await page.evaluate(() => document.activeElement.id === 'results-heading'), `${label}: focus should be on results heading`);
  const chunks = await page.$$eval('#chunk-row .chunk', (els) => els.map((e) => e.textContent));
  note(`${label}: example chunks ${chunks.join(' | ')}`);
}

export default async function () {
  // Run A: keyboard only, desktop. Chunks help: patterned strings stay right longer.
  {
    const s = await open('memory/', { init: watchDigits });
    const { page } = s;
    await runAxe(page, 'memory intro');
    check(await tabTo(page, '#start'), 'memory keyboard: could not Tab to Start');
    await page.keyboard.press('Enter');
    await waitVisible(page, '#run');
    const n = await play(page, 'key', { randomLimit: 6, patternedLimit: 9, tabSwitchOnce: true, pauseWhileTyping: true });
    note(`memory keyboard: ${n} answers`);
    await checkResults(page, 'memory keyboard');
    await runAxe(page, 'memory results');
    await activate(page, '#results .copy-btn', 'key');
    const copied = await copiedText(page, '#results .copy-box');
    note(`copied: ${copied}`);
    check(copied.startsWith('Working memory: random digits span'), 'memory copy text wrong');
    await screenshot(page, 'memory-desktop-results');
    await activate(page, '#again', 'key');
    check(await isVisible(page, '#start'), 'memory: Try it again should show Start');
    await close(s, 'memory keyboard');
    note(`page weight: ${(s.log.bytes / 1024).toFixed(1)} KB`);
    check(s.log.bytes < 150 * 1024, `memory page weight ${s.log.bytes} over 150 KB`);
  }

  // Run B: touch keypad at phone width. Short run: everything past 4 digits is wrong.
  {
    const s = await open('memory/', { width: 360, height: 740, touch: true, init: watchDigits });
    const { page } = s;
    await noSideScroll(page, 'memory phone intro');
    await activate(page, '#start', 'touch');
    await page.waitForFunction(() => !document.getElementById('answer').hidden, { timeout: 20000 });
    await noSideScroll(page, 'memory phone keypad');
    await screenshot(page, 'memory-phone-keypad');
    await play(page, 'touch', { randomLimit: 4, patternedLimit: 4 });
    await checkResults(page, 'memory touch');
    await noSideScroll(page, 'memory phone results');
    await close(s, 'memory touch');
  }

  // Run C: mouse at 200% zoom. Nothing right: spans "under 4".
  {
    const s = await open('memory/', { width: 683, height: 384, scale: 2, init: watchDigits });
    const { page } = s;
    await activate(page, '#start', 'mouse');
    await play(page, 'mouse', { randomLimit: 0, patternedLimit: 0 });
    await checkResults(page, 'memory mouse');
    const random = await text(page, '[data-fill="random-span"]');
    check(random === 'under 4', `memory mouse: expected "under 4", got ${random}`);
    await noSideScroll(page, 'memory zoom results');
    await close(s, 'memory mouse');
  }
}
