const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function mount() {
  let state;
  let onChange;
  let cleanup;
  let removed = false;
  let resolve;
  let reject;
  const preference = new Promise((res, rej) => { resolve = res; reject = rej; });
  const code = ts.transpileModule(
    readFileSync(require.resolve('../src/hooks/use-reduce-motion.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (name === 'react') return {
        useState: (initial) => { state = initial; return [state, (value) => { state = value; }]; },
        useEffect: (effect) => { cleanup = effect(); },
      };
      if (name === 'react-native') return { AccessibilityInfo: {
        isReduceMotionEnabled: () => preference,
        addEventListener: (event, callback) => {
          assert.equal(event, 'reduceMotionChanged');
          onChange = callback;
          return { remove: () => { removed = true; } };
        },
      } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  exports.useReduceMotion();
  return { get state() { return state; }, get removed() { return removed; },
    resolve, reject, change: (value) => onChange(value), unmount: () => cleanup() };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('stays still until the system preference resolves, then follows changes', async () => {
  const hook = mount();
  assert.equal(hook.state, true);
  hook.resolve(false);
  await flush();
  assert.equal(hook.state, false);
  hook.change(true);
  assert.equal(hook.state, true);
  hook.change(false);
  assert.equal(hook.state, false);
  hook.unmount();
  assert.equal(hook.removed, true);
});

test('a newer change event wins over a stale initial preference', async () => {
  const hook = mount();
  hook.change(true);
  hook.resolve(false);
  await flush();
  assert.equal(hook.state, true);
  hook.unmount();
});

test('late results cannot update state after unmount', async () => {
  const hook = mount();
  hook.unmount();
  hook.resolve(false);
  await flush();
  assert.equal(hook.state, true);
  assert.equal(hook.removed, true);
});

test('a failed preference query keeps animations disabled', async () => {
  const hook = mount();
  hook.reject(new Error('Unavailable'));
  await flush();
  assert.equal(hook.state, true);
  hook.unmount();
});
