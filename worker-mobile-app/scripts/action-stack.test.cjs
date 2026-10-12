const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(require.resolve('../src/features/home/lib/actionStack.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function('exports', 'module', code)(loaded.exports, loaded);
const { reconcileActionOrder, cycleActionOrder, isUpwardCardDrag, shouldCycleCard } = loaded.exports;

test('every reminder is reachable and cycling never dismisses or mutates one', () => {
  const ids = ['expired', 'note1', 'note2', 'note3', 'expiring'];
  let deck = ids;
  const seen = [];
  for (let i = 0; i < ids.length; i++) {
    seen.push(deck[0]);
    deck = cycleActionOrder(deck);
    assert.deepEqual([...deck].sort(), [...ids].sort());
  }
  assert.deepEqual(seen, ids);
  assert.deepEqual(deck, ids);
  assert.deepEqual(ids, ['expired', 'note1', 'note2', 'note3', 'expiring']);
});

test('refresh retains the current card, removes resolved reminders and appends new ones', () => {
  const order = ['note2', 'expired', 'note1'];
  assert.deepEqual(reconcileActionOrder(order, ['expired', 'note1', 'note2']), order);
  assert.deepEqual(reconcileActionOrder(order, ['expired', 'note2', 'new']), ['note2', 'expired', 'new']);
  assert.deepEqual(reconcileActionOrder(order, ['expired', 'note1']), ['expired', 'note1']);
  assert.deepEqual(reconcileActionOrder(order, []), []);
  assert.deepEqual(cycleActionOrder([]), []);
  assert.deepEqual(cycleActionOrder(['only']), ['only']);
});

test('taps, downward/horizontal movement and small drags do not cycle', () => {
  assert.equal(isUpwardCardDrag(0, -4), false);
  assert.equal(isUpwardCardDrag(0, 80), false);
  assert.equal(isUpwardCardDrag(60, -20), false);
  assert.equal(isUpwardCardDrag(2, -20), true);
  assert.equal(shouldCycleCard(0, -12, -1), false);
  assert.equal(shouldCycleCard(0, -30, -0.1), false);
  assert.equal(shouldCycleCard(100, -50, -1), false);
  assert.equal(shouldCycleCard(0, 80, 1), false);
  assert.equal(shouldCycleCard(4, -50, -0.1), true);
  assert.equal(shouldCycleCard(2, -20, -0.6), true);
});
