// Automated browser run-through (dev-only).
// Usage: node dev/e2e.mjs [suite ...]   e.g. node dev/e2e.mjs reaction-time
// Needs: npm install (in dev/), and Google Chrome or Microsoft Edge installed.
// Suites live in dev/e2e/<name>.mjs. Shared helpers are in dev/e2e/helpers.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start, stop, failures } from './e2e/helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const all = ['reaction-time', 'stroop', 'memory', 'patterns', 'wrappers'];
const asked = process.argv.slice(2);
const chosen = asked.length ? asked : all.filter((s) => fs.existsSync(path.join(here, 'e2e', `${s}.mjs`)));

await start();
try {
  for (const name of chosen) {
    console.log(`\n== ${name}`);
    const suite = await import(`./e2e/${name}.mjs`);
    await suite.default();
  }
} finally {
  await stop();
}

console.log(`\n${failures.length ? `${failures.length} FAILED` : 'All checks passed'}`);
for (const f of failures) console.log(`  - ${f}`);
process.exitCode = failures.length ? 1 : 0;
