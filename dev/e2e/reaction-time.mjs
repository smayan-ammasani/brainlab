// Reaction time page run-through.
import {
  open, close, check, note, sleep, runAxe, noSideScroll, isVisible, waitVisible, text, setHidden, screenshot,
} from './helpers.mjs';
import { pressOn, activate, tabTo, copiedText } from './common.mjs';

// Records when each tone is scheduled, so the test can "hear" it.
function listenForTones() {
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when) {
    window.__tone = { ctx: this.context, when };
    return start.call(this, when);
  };
}

// Plays tries until the selector becomes visible. Responds about 250 ms after
// each light or beep, like a quick but human student.
async function playUntil(page, doneSelector, how, { tooSoonOnce = false, tabSwitchOnce = false, pauseOnce = false } = {}) {
  let responses = 0;
  let didTooSoon = !tooSoonOnce;
  let didSwitch = !tabSwitchOnce;
  let didPause = !pauseOnce;
  const deadline = Date.now() + 240000;
  while (!(await isVisible(page, doneSelector))) {
    check(Date.now() < deadline, 'reaction time: run did not finish in time');
    if (Date.now() > deadline) return responses;
    const s = await page.evaluate(() => {
      const stage = document.getElementById('stage');
      const tone = window.__tone;
      return {
        go: stage.classList.contains('go'),
        waiting: /Wait for it|Watch for|Listen for/.test(stage.textContent),
        ear: !document.getElementById('cue-ear').hidden,
        heard: !!tone && tone.ctx.currentTime >= tone.when + 0.25,
        paused: !document.getElementById('paused').hidden,
      };
    });
    if (s.paused) {
      await sleep(200);
      continue;
    }
    if (s.waiting && !s.ear && !didSwitch && responses === 1) {
      didSwitch = true;
      await setHidden(page, true);
      await sleep(200);
      check(await isVisible(page, '#paused'), 'tab switch should pause');
      await setHidden(page, false);
      await activate(page, '#resume', how);
      continue;
    }
    if (s.waiting && !s.ear && !didPause && responses === 2) {
      didPause = true;
      await page.keyboard.press('Escape');
      await sleep(200);
      check(await isVisible(page, '#paused'), 'Esc should pause');
      check(await page.evaluate(() => document.activeElement.id === 'paused-heading'), 'focus should move to Paused heading');
      await activate(page, '#resume', how);
      continue;
    }
    if (s.waiting && !s.ear && !didTooSoon && responses === 3) {
      didTooSoon = true;
      await pressOn(page, '#stage', how);
      await sleep(100);
      check((await text(page, '#stage-text')).startsWith('Too soon'), 'early press should say Too soon');
      continue;
    }
    if (s.go || (s.ear && s.heard)) {
      await sleep(s.go ? 230 + Math.random() * 60 : 0);
      await pressOn(page, '#stage', how);
      await page.evaluate(() => { window.__tone = null; });
      responses++;
      await sleep(250);
      continue;
    }
    await sleep(25);
  }
  return responses;
}

async function checkSightResults(page, label) {
  const avg = Number(await text(page, '#results [data-fill="avg"]'));
  const spread = Number(await text(page, '#results [data-fill="spread"]'));
  note(`${label}: sight average ${avg} ms, spread ${spread} ms`);
  check(avg > 150 && avg < 700, `${label}: average ${avg} looks wrong`);
  check(Number.isFinite(spread), `${label}: spread is not a number`);
  const body = await page.evaluate(() => document.body.innerText);
  check(!/NaN|undefined/.test(body), `${label}: page shows NaN or undefined`);
  check(await page.$eval('#dot-plot svg', (svg) => svg.querySelectorAll('circle').length === 10), `${label}: dot plot should have 10 dots`);
  check(await isVisible(page, '#split-bar svg'), `${label}: split bar missing`);
  const focused = await page.evaluate(() => document.activeElement.id);
  check(focused === 'results-heading', `${label}: focus should be on results heading, was ${focused}`);
}

export default async function () {
  // Run A: desktop, keyboard only, with sound round.
  {
    const s = await open('reaction-time/', { init: listenForTones });
    const { page } = s;
    await runAxe(page, 'reaction-time intro');
    check(await tabTo(page, '#start'), 'keyboard: could not Tab to Start');
    await page.keyboard.press('Enter');
    await waitVisible(page, '#run');
    check(await page.evaluate(() => document.activeElement.id === 'run-heading'), 'focus should move to run heading');
    const n = await playUntil(page, '#results', 'key', { tooSoonOnce: true, tabSwitchOnce: true, pauseOnce: true });
    check(n === 13, `keyboard: expected 13 responses, got ${n}`);
    await checkSightResults(page, 'keyboard');
    await runAxe(page, 'reaction-time results');

    await activate(page, '#results .copy-btn', 'key');
    const copied = await copiedText(page, '#results .copy-box');
    check(copied.startsWith('Reaction time (sight): average'), `copy text wrong: "${copied}"`);

    await activate(page, '#start-twist', 'key');
    const m = await playUntil(page, '#twist-results', 'key');
    check(m === 14, `sound round: expected 14 responses, got ${m}`);
    const shown = await page.$$eval('#twist-results [data-outcome]', (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.outcome));
    note(`sound round outcome blocks shown: ${shown.join(', ')}`);
    check(shown.includes('measured'), 'sound round should show measured results');
    check(await page.$eval('#sense-bars svg', (svg) => svg.querySelectorAll('rect').length === 2), 'sense bars missing');
    await activate(page, '#twist-results .copy-btn', 'key');
    const copied2 = await copiedText(page, '#twist-results .copy-box');
    note(`copied: ${copied2}`);
    check(copied2.startsWith('Reaction time (sight vs. sound)'), 'sense copy text wrong');
    await runAxe(page, 'reaction-time twist results');
    await screenshot(page, 'rt-desktop-results');

    await activate(page, '#again', 'key');
    check(await isVisible(page, '#start'), 'Try it again should show Start');
    check(!(await isVisible(page, '#results')), 'Try it again should hide results');
    await close(s, 'reaction-time keyboard');
    note(`page weight: ${(s.log.bytes / 1024).toFixed(1)} KB`);
    check(s.log.bytes < 150 * 1024, `page weight ${s.log.bytes} over 150 KB`);
  }

  // Run B: phone width, touch, clipboard blocked (tests the copy fallback), skip the sound round.
  {
    const blockClipboard = () => {
      navigator.clipboard.writeText = () => Promise.reject(new Error('blocked by test'));
    };
    const s = await open('reaction-time/', { width: 360, height: 740, touch: true, clipboard: false, init: blockClipboard });
    const { page } = s;
    await noSideScroll(page, 'phone intro');
    await activate(page, '#start', 'touch');
    await noSideScroll(page, 'phone run');
    await playUntil(page, '#results', 'touch', { tabSwitchOnce: true });
    await checkSightResults(page, 'touch');
    await noSideScroll(page, 'phone results');
    await activate(page, '#results .copy-btn', 'touch');
    const copied = await copiedText(page, '#results .copy-box');
    check(copied.startsWith('Reaction time (sight)'), `touch copy fallback wrong: "${copied}"`);
    await activate(page, '#skip-twist', 'touch');
    check(await isVisible(page, '#twist-results [data-outcome="skipped"]'), 'skip should show typical results');
    check(!(await isVisible(page, '#twist-results .copy-box')), 'skip should hide copy button');
    await noSideScroll(page, 'phone twist results');
    await screenshot(page, 'rt-phone-results');
    await close(s, 'reaction-time touch');
  }

  // Run C: mouse at 200% zoom (683 px wide at 2x), reduced motion.
  {
    const s = await open('reaction-time/', { width: 683, height: 384, scale: 2, reducedMotion: true });
    const { page } = s;
    await noSideScroll(page, 'zoom intro');
    await activate(page, '#start', 'mouse');
    await playUntil(page, '#results', 'mouse');
    await checkSightResults(page, 'mouse');
    await noSideScroll(page, 'zoom results');
    await close(s, 'reaction-time mouse');
  }
}
