// Input helpers shared by the experiment suites (dev-only).
import { sleep } from './helpers.mjs';

// Presses on an element the way a student would: keyboard key, mouse, or finger.
export async function pressOn(page, selector, how, key = 'Space') {
  if (how === 'key') {
    await page.keyboard.press(key);
    return;
  }
  // ElementHandle.tap() and .click() scroll the element into view and press its center.
  const el = await page.$(selector);
  if (how === 'touch') await el.tap();
  else await el.click();
}

// Activates a button by keyboard (focus and Enter), mouse, or touch.
export async function activate(page, selector, how) {
  if (how === 'key') {
    await page.focus(selector);
    await page.keyboard.press('Enter');
  } else {
    await pressOn(page, selector, how);
  }
  await sleep(150);
}

// Tabs through the page until the element has focus (true keyboard-only path).
export async function tabTo(page, selector, max = 60) {
  for (let i = 0; i < max; i++) {
    const hit = await page.evaluate((s) => document.activeElement === document.querySelector(s), selector);
    if (hit) return true;
    await page.keyboard.press('Tab');
  }
  return false;
}

// Reads the copy box after "Copy my results": clipboard text, or the fallback box.
export async function copiedText(page, boxSelector) {
  await sleep(300);
  const status = await page.$eval(`${boxSelector} .copy-status`, (el) => el.textContent);
  if (status.includes('Copied')) return page.evaluate(() => navigator.clipboard.readText());
  return page.$eval(`${boxSelector} .copy-fallback`, (el) => (el.hidden ? '' : el.value));
}
