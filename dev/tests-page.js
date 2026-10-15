// Browser test runner for dev/tests.html.
import { runAll } from './tests/harness.js';
import './tests/all.js';

const list = document.getElementById('results');
const { passed, failed } = await runAll(({ name, ok, error }) => {
  const li = document.createElement('li');
  li.textContent = ok ? `ok: ${name}` : `FAIL: ${name}: ${error && error.message}`;
  li.className = ok ? 'test-ok' : 'test-fail';
  list.append(li);
});
document.getElementById('summary').textContent = `${passed} passed, ${failed} failed`;
document.body.dataset.done = failed ? 'fail' : 'pass';
