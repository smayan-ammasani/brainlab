// Renders dev/og-image.svg to og-image.png at the repo root (dev-only).
// Usage: node dev/make-og-image.mjs
// The PNG is the link preview image that chat apps and social sites show.
// No page loads it, so it doesn't count toward any page's weight.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630 });
await page.goto(pathToFileURL(path.join(ROOT, 'dev', 'og-image.svg')).href);
await page.screenshot({ path: path.join(ROOT, 'og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log(`og-image.png: ${(fs.statSync(path.join(ROOT, 'og-image.png')).size / 1024).toFixed(1)} KB`);
