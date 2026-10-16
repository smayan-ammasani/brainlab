// Wrapper pages, plus checks that apply to every page: internal links work,
// keyboard focus is always visible, no sideways scrolling, axe is clean.
import { open, close, check, note, runAxe, noSideScroll, screenshot } from './helpers.mjs';

const WRAPPERS = ['', 'teachers/', 'privacy/', 'about/', 'learn-more/'];
const EXPERIMENTS = ['reaction-time/', 'stroop/', 'memory/', 'patterns/'];

// Tabs through the whole page. Every stop must show a visible focus style.
async function keyboardPass(page, label) {
  const seen = [];
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el.dataset.e2eSeen) return null; // wrapped around
      el.dataset.e2eSeen = '1';
      const s = getComputedStyle(el);
      const card = el.closest('.card');
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
      const cardOutline = card && getComputedStyle(card).outlineStyle !== 'none';
      return { id: `${el.tagName.toLowerCase()} ${(el.textContent || '').trim().slice(0, 30)}`, visible: outline || cardOutline };
    });
    if (!info) break;
    seen.push(info.id);
    check(info.visible, `${label}: focus not visible on ${info.id}`);
  }
  check(seen.length > 3, `${label}: keyboard reached only ${seen.length} stops`);
  return seen.length;
}

// Every relative link on the page should load.
async function checkLinks(page, label) {
  const links = await page.$$eval('a[href]', (as) => as.map((a) => ({ raw: a.getAttribute('href'), url: a.href })));
  for (const { raw, url } of links) {
    if (/^https?:/.test(raw)) continue; // outbound links are checked by hand before launch
    check(!raw.startsWith('/'), `${label}: link ${raw} starts with / (must be relative)`);
    if (raw.startsWith('#')) continue;
    const res = await fetch(url);
    check(res.ok, `${label}: link ${raw} -> ${res.status}`);
  }
}

export default async function () {
  for (const path of [...WRAPPERS, ...EXPERIMENTS]) {
    const label = path || 'home';
    const s = await open(path);
    const { page } = s;
    if (WRAPPERS.includes(path)) await runAxe(page, label);
    await checkLinks(page, label);
    const stops = await keyboardPass(page, label);
    await close(s, label);
    note(`${label}: ${stops} keyboard stops, ${(s.log.bytes / 1024).toFixed(1)} KB`);
    check(s.log.bytes < 150 * 1024, `${label}: page weight over 150 KB`);

    const phone = await open(path, { width: 360, height: 740, touch: true });
    await noSideScroll(phone.page, `${label} at 360 px`);
    if (WRAPPERS.includes(path)) await screenshot(phone.page, `wrapper-${label.replace('/', '')}-phone`);
    await close(phone, `${label} phone`);

    const zoom = await open(path, { width: 683, height: 384, scale: 2 });
    await noSideScroll(zoom.page, `${label} at 200% zoom`);
    if (WRAPPERS.includes(path)) await screenshot(zoom.page, `wrapper-${label.replace('/', '')}-zoom`);
    await close(zoom, `${label} zoom`);
  }
}
