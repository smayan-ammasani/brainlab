// Static audit of the site files (dev-only). Usage: node dev/audit.mjs
// Checks the hard constraints that can be read straight from the files:
// identical CSP on every page, nothing inline, no storage or network APIs,
// every http(s) URL is an outbound link, no em dashes, SVGs have text
// alternatives, page weight, and an estimated reading level.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
const PAGES = ['index.html', 'reaction-time/index.html', 'stroop/index.html', 'memory/index.html', 'patterns/index.html',
  'teachers/index.html', 'privacy/index.html', 'about/index.html', 'learn-more/index.html', '404.html'];
const STUDENT_PAGES = ['index.html', 'reaction-time/index.html', 'stroop/index.html', 'memory/index.html', 'patterns/index.html', 'learn-more/index.html'];

const problems = [];
const fail = (msg) => problems.push(msg);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    if (['node_modules', '.git', 'out'].includes(name)) continue;
    const rel = path.join(dir, name);
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

// ---------- Every page ----------

for (const page of PAGES) {
  const html = read(page);
  if (!html.includes(CSP)) fail(`${page}: CSP missing or different`);
  if (!html.includes('<meta name="referrer" content="no-referrer">')) fail(`${page}: referrer meta missing`);
  if (!/<html lang="en">/.test(html)) fail(`${page}: missing lang="en"`);
  if (!/<meta name="description" content="[^"]+">/.test(html)) fail(`${page}: missing description`);
  if ((html.match(/<link rel="stylesheet"/g) || []).length !== 1) fail(`${page}: should have exactly one stylesheet`);
  const scripts = html.match(/<script\b[^>]*>/g) || [];
  if (scripts.length > 1) fail(`${page}: more than one script`);
  for (const s of scripts) if (!/type="module" src="[^"]+"/.test(s)) fail(`${page}: script is not an external module: ${s}`);
  if (/<script\b[^>]*>[^<]+<\/script>/.test(html)) fail(`${page}: inline script content`);
  if (/<style\b/i.test(html)) fail(`${page}: <style> block`);
  if (/\sstyle="/i.test(html)) fail(`${page}: style attribute`);
  if (/\son[a-z]+="/i.test(html)) fail(`${page}: inline event handler`);
  // Internal links must be relative. 404.html is the exception: GitHub Pages
  // serves it at any missing path, so it uses root-based links on purpose.
  for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
    if (href.startsWith('/') && page !== '404.html') fail(`${page}: root-relative link ${href}`);
  }
  // Every svg needs a text alternative or must be hidden from screen readers.
  for (const [svg] of html.matchAll(/<svg\b[^>]*>/g)) {
    const ok = /aria-hidden="true"/.test(svg) || (/role="img"/.test(svg) && /aria-labelledby="/.test(svg));
    if (!ok) fail(`${page}: svg without text alternative: ${svg.slice(0, 80)}`);
  }
}

// ---------- Scripts ----------

const jsFiles = walk('js').filter((f) => f.endsWith('.js'));
const banned = ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon',
  'WebSocket', 'EventSource', 'getUserMedia', 'geolocation', 'Notification', 'import(', 'innerHTML', 'setAttribute(\'style',
  'eval(', 'new Function'];
for (const f of jsFiles) {
  const src = read(f);
  for (const b of banned) if (src.includes(b)) fail(`${f}: uses ${b}`);
}

// ---------- URLs, em dashes ----------

const siteFiles = walk('.').filter((f) => !f.startsWith('dev/') && !f.startsWith('.git') && /\.(html|css|js|svg)$/.test(f));
for (const f of siteFiles) {
  const src = read(f);
  for (const m of src.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
    const before = src.slice(Math.max(0, m.index - 6), m.index);
    const isLink = before.endsWith('href="');
    const isNamespace = m[0].startsWith('http://www.w3.org/2000/svg');
    // Link preview tags name the site's own public address; browsers never fetch them.
    const isPreviewTag = /<meta property="og:[^>]*$/.test(src.slice(Math.max(0, m.index - 80), m.index));
    if (!isLink && !isNamespace && !isPreviewTag) fail(`${f}: URL that is not an outbound link: ${m[0]}`);
  }
}
const EM_DASH = String.fromCharCode(0x2014);
const textFiles = walk('.').filter((f) => /\.(html|css|js|mjs|md|json|svg)$/.test(f) && !f.endsWith('package-lock.json'));
for (const f of textFiles) {
  const lines = read(f).split('\n');
  lines.forEach((line, i) => { if (line.includes(EM_DASH)) fail(`${f}:${i + 1}: em dash`); });
}

// ---------- Page weight ----------

function moduleGraph(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const src = read(file);
  for (const [, spec] of src.matchAll(/^import[^'"]*['"](\.[^'"]+)['"]/gm)) {
    moduleGraph(path.posix.join(path.posix.dirname(file), spec), seen);
  }
  return seen;
}

const weights = [];
for (const page of PAGES) {
  const html = read(page);
  const files = new Set([page]);
  const dir = path.posix.dirname(page);
  // Root-based links (only in 404.html) start with the site's root path, like
  // /brainlab/css/site.css, or just /css/site.css on a custom domain.
  const local = (href) => {
    if (!href.startsWith('/')) return path.posix.join(dir, href);
    const withoutRepo = href.replace(/^\/[^/]+\//, '');
    return fs.existsSync(path.join(ROOT, withoutRepo)) ? withoutRepo : href.slice(1);
  };
  for (const [, href] of html.matchAll(/<link[^>]+href="([^"[]+)"/g)) files.add(local(href));
  for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) for (const m of moduleGraph(path.posix.join(dir, src))) files.add(m);
  const bytes = [...files].reduce((sum, f) => sum + fs.statSync(path.join(ROOT, f)).size, 0);
  weights.push([page, bytes]);
  if (bytes > 150 * 1024) fail(`${page}: ${bytes} bytes, over 150 KB`);
}

// ---------- Reading level (Flesch-Kincaid grade, rough) ----------

function visibleText(html) {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<header[\s\S]*?<\/header>/, '')
    .replace(/<footer[\s\S]*?<\/footer>/, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<\/(p|li|h1|h2|h3|td|th|figcaption|summary|caption)>/g, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\[Site Name\]/g, 'This site')
    .replace(/\s+/g, ' ');
}

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function grade(text) {
  const sentences = text.split(/[.!?]+\s/).filter((s) => /[a-z]/i.test(s));
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const syl = words.reduce((sum, w) => sum + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

// ---------- Words that could sound like a judgment ----------

const watchWords = /\b(normal|abnormal|below average|above average|percentile|IQ|intelligen\w*|disorder|diagnos\w*|deficit|impair\w*|dementia|ADHD|decline|gifted|failed?|bad|poor)\b/gi;
const flagged = [];
for (const page of PAGES) {
  const text = visibleText(read(page));
  for (const m of text.matchAll(watchWords)) {
    flagged.push(`${page}: "...${text.slice(Math.max(0, m.index - 50), m.index + 40).trim()}..."`);
  }
}

// ---------- Report ----------

console.log('Page weight (HTML + CSS + JS modules + favicon not counted):');
for (const [p, b] of weights) console.log(`  ${(b / 1024).toFixed(1).padStart(6)} KB  ${p}`);
console.log('\nReading level (Flesch-Kincaid grade, rough estimate):');
for (const p of PAGES) {
  const g = grade(visibleText(read(p)));
  console.log(`  ${g.toFixed(1).padStart(5)}  ${p}${STUDENT_PAGES.includes(p) ? '' : '  (adult audience)'}`);
}
console.log('\nWords to review by hand (may be fine in context):');
for (const f of flagged) console.log(`  ${f}`);
console.log(`\n${problems.length ? `${problems.length} PROBLEMS` : 'No problems found'}`);
for (const p of problems) console.log(`  - ${p}`);
process.exitCode = problems.length ? 1 : 0;
