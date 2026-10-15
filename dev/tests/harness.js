// A tiny test harness that runs the same way in Node and in a browser.
// Test files call test() to register; the runners call runAll().

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message} expected ${e}, got ${a}`.trim());
}

export function assertClose(actual, expected, tolerance = 1e-9, message = '') {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${message} expected ${expected} (within ${tolerance}), got ${actual}`.trim());
  }
}

// Runs every registered test and calls report({ name, ok, error }) for each.
export async function runAll(report) {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      report({ name, ok: true });
    } catch (error) {
      failed++;
      report({ name, ok: false, error });
    }
  }
  return { passed, failed };
}
