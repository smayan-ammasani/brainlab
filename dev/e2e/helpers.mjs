// Shared helpers for the browser run-through (dev-only).
// Serves the repo with a tiny static server, drives Chrome with puppeteer-core,
// and checks console errors, network requests after load, layout overflow,
// axe-core accessibility rules, and page weight.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'dev', 'out');
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
};

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const failures = [];
const notes = [];

export function check(condition, message) {
  if (!condition) {
    failures.push(message);
    console.log(`    FAIL ${message}`);
  }
}

export function note(message) {
  notes.push(message);
  console.log(`    ${message}`);
}

const axeSource = fs.readFileSync(path.join(ROOT, 'dev', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

export async function runAxe(page, label) {
  // page.evaluate runs through the DevTools protocol, so the page's CSP does not block it.
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  });
  check(result.length === 0, `axe ${label}: ${result.join('; ')}`);
}

export async function noSideScroll(page, label) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(sw <= cw, `${label}: page scrolls sideways (${sw} > ${cw})`);
}

export async function isVisible(page, selector) {
  return page.$eval(selector, (el) => !el.closest('[hidden]') && el.getClientRects().length > 0).catch(() => false);
}

export async function waitVisible(page, selector, timeout = 15000) {
  await page.waitForFunction((s) => {
    const el = document.querySelector(s);
    return el && !el.closest('[hidden]') && el.getClientRects().length > 0;
  }, { timeout }, selector);
}

export async function text(page, selector) {
  return page.$eval(selector, (el) => el.textContent.trim());
}

// Pretends the student switched tabs, then switched back.
export async function setHidden(page, hidden) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

let browser;
let base;
let server;

export async function start() {
  server = await serve();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
}

export async function stop() {
  await browser.close();
  server.close();
}

// Opens a page and starts watching for console errors and late network requests.
export async function open(urlPath, { width = 1366, height = 768, touch = false, scale = 1, reducedMotion = false, clipboard = true, init = null } = {}) {
  const context = await browser.createBrowserContext();
  if (clipboard) await context.overridePermissions(base, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  const page = await context.newPage();
  if (init) await page.evaluateOnNewDocument(init);
  await page.setViewport({ width, height, deviceScaleFactor: scale, hasTouch: touch, isMobile: touch });
  if (reducedMotion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const log = { errors: [], late: [], bytes: 0, files: [] };
  let loaded = false;
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('pageerror', (e) => log.errors.push(String(e)));
  // The browser itself fetches the same-site favicon just after load. That is
  // part of loading the page, not a request made by our code, so it is allowed.
  page.on('request', (r) => { if (loaded && !r.url().endsWith('/favicon.svg')) log.late.push(r.url()); });
  page.on('response', async (r) => {
    try {
      const buf = await r.buffer();
      log.bytes += buf.length;
      log.files.push(`${r.url().replace(base, '')} ${buf.length}`);
    } catch { /* redirects have no body */ }
  });
  await page.goto(base + urlPath, { waitUntil: 'load' });
  await sleep(300);
  loaded = true;
  return { page, log, context };
}

export async function close({ page, log, context }, label) {
  check(log.errors.length === 0, `${label}: console errors: ${log.errors.join(' | ')}`);
  check(log.late.length === 0, `${label}: network requests after load: ${log.late.join(', ')}`);
  await context.close();
}

export async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

