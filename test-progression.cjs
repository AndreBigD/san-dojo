const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('./dist/progression.js');
const monday = Date.parse('2026-10-26T03:00:00Z');
const nextMonday = Date.parse('2026-11-02T03:00:00Z');
test('Monday midnight is evaluated in São Paulo, independently of device timezone', () => {
  assert.equal(G.weekKey(nextMonday - 1), '2026-10-26');
  assert.equal(G.weekKey(nextMonday), '2026-11-02');
});
test('200 XP promotes exactly once at weekly close; total weekly score resets', () => {
  const g = G.create(monday); G.credit(g, 200, monday);
  assert.equal(g.belt, 0); assert.equal(G.reconcile(g, nextMonday).length, 1);
  assert.equal(g.belt, 1); assert.equal(G.current(g).xp, 0);
  assert.equal(g.history[0].xp, 200); assert.equal(g.highestBelt, 1);
  assert.equal(G.reconcile(g, nextMonday).length, 0); assert.equal(g.belt, 1);
});
test('maintenance threshold includes 80 and 199; below 80 demotes just one rung', () => {
  for (const xp of [80, 199]) { const g = G.create(monday); g.belt = 4; G.credit(g, xp, monday); G.reconcile(g, nextMonday); assert.equal(g.belt, 4); }
  const g = G.create(monday); g.belt = 4; G.credit(g, 79, monday); G.reconcile(g, nextMonday); assert.equal(g.belt, 3);
});
test('several missed weeks settle in order and never go below white', () => {
  const g = G.create(monday); g.belt = 2; g.highestBelt = 2;
  const results = G.reconcile(g, nextMonday + 3 * 7 * 86400000);
  assert.equal(results.length, 4); assert.deepEqual(results.map(r => r.to), [1, 0, 0, 0]); assert.equal(g.highestBelt, 2);
});
test('the 13 exact ranks end in first dan and never overflow', () => {
  assert.equal(G.BELTS.length, 13); assert.match(G.BELTS[12].name, /1º dan/);
  const g = G.create(monday); g.belt = 12; g.highestBelt = 12; G.credit(g, 1000, monday); G.reconcile(g, nextMonday); assert.equal(g.belt, 12);
});
test('free launch allows unlimited attempts, including old exhausted accounts', () => {
 for (const oldCount of [0, 2, 5]) {
  const g=G.create(monday);g.energy.count=oldCount;g.premiumDemoUntil=0;
  for(let i=0;i<100;i++)assert.deepEqual(G.reserve(g,monday+i),{allowed:true,charged:false});
  assert.equal(G.unlimited(g),true);assert.equal(G.nextChargeMs(g,monday+1000),0);
  assert.equal(g.energy.count,5);assert.doesNotThrow(()=>JSON.stringify(g));
 }
});
test('expired Premium demos still have free unlimited energy', () => {
 const g=G.create(monday);g.energy.count=0;g.premiumDemoUntil=monday-1;
 assert.equal(G.premium(g,monday),false);assert.deepEqual(G.reserve(g,monday),{allowed:true,charged:false});
});
test('a completion credits the week at completion time after a boundary', () => {
  const g = G.create(monday); G.credit(g, 200, monday);
  G.credit(g, 20, nextMonday); assert.equal(g.belt, 1); assert.equal(G.current(g).xp, 20);
  assert.equal(g.history[0].xp, 200);
});
