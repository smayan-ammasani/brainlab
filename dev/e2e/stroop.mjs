// Stroop test run-through.
import {
  open, close, check, note, sleep, runAxe, noSideScroll, isVisible, waitVisible, text, setHidden, screenshot,
} from './helpers.mjs';
import { pressOn, activate, tabTo, copiedText } from './common.mjs';

const COLORS = ['ORANGE', 'BLUE', 'GREEN', 'PINK'];

// Reads the stage: is a word or digit row showing, and what is the right answer?
async function readStage(page) {
  return page.evaluate((colors) => {
    const el = document.getElementById('stimulus');
    const ink = el.className.match(/ink-(\d)/);
    const digits = /^\d( \d)*$/.test(el.textContent);
    let answer = -1;
    let match = false;
    if (ink) {
      answer = Number(ink[1]);
      match = colors[answer] === el.textContent;
    } else if (digits) {
      const parts = el.textContent.split(' ');
      answer = parts.length - 1;
      match = Number(parts[0]) === parts.length;
    }
    return {
      showing: answer >= 0,
      answer,
      match,
      fixation: el.classList.contains('fixation'),
      paused: !document.getElementById('paused').hidden,
      message: el.textContent,
    };
  }, COLORS);
}

// Answers every try. Mismatching tries get an extra 90 ms so the effect shows up.
async function play(page, how, { wrongEvery = 0, tooSoonOnce = false, tabSwitchOnce = false, timeoutOnce = false, sameSpeed = false } = {}) {
  let answered = 0;
  let didTooSoon = !tooSoonOnce;
  let didSwitch = !tabSwitchOnce;
  let didTimeout = !timeoutOnce;
  const deadline = Date.now() + 240000;
  while (!(await isVisible(page, '#results'))) {
    if (Date.now() > deadline) {
      check(false, 'stroop: run did not finish in time');
      return answered;
    }
    const s = await readStage(page);
    if (s.paused) {
      await sleep(100);
      continue;
    }
    if (s.fixation && !didTooSoon && answered === 2) {
      didTooSoon = true;
      await pressOn(page, '.answer[data-answer="0"]', how, '1');
      await sleep(80);
      check((await text(page, '#stimulus')).startsWith('Too soon'), 'stroop: early press should say Too soon');
      continue;
    }
    if (s.fixation && !didSwitch && answered === 4) {
      didSwitch = true;
      await setHidden(page, true);
      await sleep(150);
      check(await isVisible(page, '#paused'), 'stroop: tab switch should pause');
      await setHidden(page, false);
      await activate(page, '#resume', how === 'key' ? 'key' : how);
      continue;
    }
    if (s.showing) {
      if (!didTimeout && answered === 1) {
        didTimeout = true;
        await sleep(3300);
        check((await text(page, '#stimulus')).startsWith("Time's up"), 'stroop: a slow try should time out');
        answered++;
        continue;
      }
      await sleep(380 + (s.match || sameSpeed ? 0 : 90) + Math.random() * 40);
      let answer = s.answer;
      if (wrongEvery && answered % wrongEvery === wrongEvery - 1) answer = (answer + 1) % 4;
      await pressOn(page, `.answer[data-answer="${answer}"]`, how, String(answer + 1));
      answered++;
      await page.waitForFunction(() => {
        const el = document.getElementById('stimulus');
        return !/ink-\d/.test(el.className) && !/^\d( \d)*$/.test(el.textContent);
      }, { timeout: 5000 }).catch(() => {});
      continue;
    }
    await sleep(20);
  }
  return answered;
}

async function checkResults(page, label, expectOutcome) {
  const body = await page.evaluate(() => document.body.innerText);
  check(!/NaN|undefined/.test(body), `${label}: page shows NaN or undefined`);
  const effect = await text(page, '#results [data-fill="effect"]');
  const shown = await page.$$eval('[data-outcome]', (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.outcome));
  note(`${label}: match ${await text(page, '[data-fill="match"]')}, mismatch ${await text(page, '[data-fill="mismatch"]')}, effect ${effect}, outcome ${shown.join(', ')}`);
  if (expectOutcome) check(shown.includes(expectOutcome), `${label}: expected outcome ${expectOutcome}`);
  check(await page.$eval('#stroop-bars svg', (svg) => svg.querySelectorAll('rect').length === 2), `${label}: bars missing`);
  check(await page.evaluate(() => document.activeElement.id === 'results-heading'), `${label}: focus should be on results heading`);
}

export default async function () {
  // Run A: colors, keyboard only, desktop.
  {
    const s = await open('stroop/');
    const { page } = s;
    await runAxe(page, 'stroop intro');
    check(await tabTo(page, '#start'), 'stroop keyboard: could not Tab to Start');
    await page.keyboard.press('Enter');
    await waitVisible(page, '#run');
    const n = await play(page, 'key', { wrongEvery: 12, tooSoonOnce: true, tabSwitchOnce: true, timeoutOnce: true });
    note(`stroop keyboard: ${n} answers`);
    await checkResults(page, 'stroop keyboard', 'effect');
    const mistakes = Number(await text(page, '[data-fill="match-mistakes"]')) + Number(await text(page, '[data-fill="mismatch-mistakes"]'));
    check(mistakes >= 2, `stroop keyboard: expected some mistakes, got ${mistakes}`);
    await runAxe(page, 'stroop results');
    await activate(page, '#results .copy-btn', 'key');
    const copied = await copiedText(page, '#results .copy-box');
    note(`copied: ${copied}`);
    check(copied.startsWith('Stroop test (colors): matching average'), 'stroop copy text wrong');
    await screenshot(page, 'stroop-desktop-results');
    await activate(page, '#again', 'key');
    check(await isVisible(page, '#start'), 'stroop: Try it again should show Start');
    await close(s, 'stroop keyboard');
    note(`page weight: ${(s.log.bytes / 1024).toFixed(1)} KB`);
    check(s.log.bytes < 150 * 1024, `stroop page weight ${s.log.bytes} over 150 KB`);
  }

  // Run B: numbers version, touch, phone width.
  {
    const s = await open('stroop/', { width: 360, height: 740, touch: true });
    const { page } = s;
    await activate(page, '#switch-version', 'touch');
    check(await isVisible(page, '.warmup-digits'), 'numbers version should show the digit warm-up');
    await noSideScroll(page, 'stroop phone intro');
    await runAxe(page, 'stroop numbers intro');
    await activate(page, '#start', 'touch');
    await noSideScroll(page, 'stroop phone run');
    await screenshot(page, 'stroop-phone-run');
    await play(page, 'touch', { tabSwitchOnce: true });
    await checkResults(page, 'stroop touch numbers', 'effect');
    await noSideScroll(page, 'stroop phone results');
    await close(s, 'stroop touch');
  }

  // Run C: mouse at 200% zoom, answers the same speed for both kinds (no effect).
  {
    const s = await open('stroop/', { width: 683, height: 384, scale: 2 });
    const { page } = s;
    await noSideScroll(page, 'stroop zoom intro');
    await activate(page, '#start', 'mouse');
    await play(page, 'mouse', { sameSpeed: true });
    await checkResults(page, 'stroop mouse', 'no-effect');
    await noSideScroll(page, 'stroop zoom results');
    await close(s, 'stroop mouse');
  }
}
