// Node test runner: node dev/run-tests.mjs
import { runAll } from './tests/harness.js';
import './tests/all.js';

const { passed, failed } = await runAll(({ name, ok, error }) => {
  if (ok) console.log(`  ok    ${name}`);
  else console.log(`  FAIL  ${name}\n        ${error && error.message}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
