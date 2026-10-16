// Sets the site's public address everywhere it is needed (dev-only).
// Usage: node dev/site-url.mjs https://smayan-ammasani.github.io/brainlab/
//        node dev/site-url.mjs https://brainlabb.org/
// It rewrites the Open Graph (link preview) tags on every page, builds
// 404.html from dev/404.template.html, and writes or removes CNAME.
// Safe to run again: it replaces whatever it wrote last time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'reaction-time/index.html', 'stroop/index.html', 'memory/index.html', 'patterns/index.html',
  'teachers/index.html', 'privacy/index.html', 'about/index.html', 'learn-more/index.html'];

const arg = process.argv[2];
if (!arg || !/^https:\/\/[^/]+\/([^/]+\/)?$/.test(arg)) {
  console.error('Give the site URL with a trailing slash, for example https://smayan-ammasani.github.io/brainlab/');
  process.exit(1);
}
const base = new URL(arg);
const rootPath = base.pathname.replace(/\/$/, ''); // "/brainlab" or ""

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

for (const page of PAGES) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8');
  // Remove the tags this script added before.
  html = html.replace(/<meta (property="og:|name="twitter:)[^>]*>\r?\n/g, '');
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  const description = html.match(/<meta name="description" content="([^"]+)">/)[1];
  const url = new URL(page.replace(/index\.html$/, ''), base).href;
  const tags = [
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="BrainLab">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${attr(url)}">`,
    `<meta property="og:image" content="${attr(new URL('og-image.png', base).href)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="BrainLab: run real experiments on your own brain.">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].map((t) => `${t}\n`).join('');
  const withTags = html.replace(/(<meta name="description" content="[^"]+">\r?\n)/, `$1${tags}`);
  if (withTags === html) throw new Error(`${page}: no description meta to anchor the tags`);
  fs.writeFileSync(file, withTags);
}

const template = fs.readFileSync(path.join(ROOT, 'dev', '404.template.html'), 'utf8');
fs.writeFileSync(path.join(ROOT, '404.html'), template.split('[site root]').join(rootPath));

const cname = path.join(ROOT, 'CNAME');
if (base.hostname.endsWith('.github.io')) {
  if (fs.existsSync(cname)) fs.unlinkSync(cname);
} else {
  fs.writeFileSync(cname, `${base.hostname}\n`);
}

console.log(`Site URL set to ${base.href} (root path "${rootPath}")`);
