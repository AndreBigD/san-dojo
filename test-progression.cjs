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
test('25 energy covers exactly five activities at 5 energy each',()=>{
 const g=G.create(monday);for(let i=0;i<5;i++)assert.deepEqual(G.reserve(g,monday),{allowed:true,charged:true});assert.equal(g.energy.count,0);assert.equal(G.reserve(g,monday).allowed,false);assert.equal(G.unlimited(g),false);
});
test('recovery adds 5 per 30 minutes, caps at 25 and handles backward clocks',()=>{
 const g=G.create(monday);for(let i=0;i<5;i++)G.reserve(g,monday);assert.equal(G.refill(g,monday+G.RULES.refillMs-1),0);assert.equal(G.refill(g,monday+G.RULES.refillMs),5);assert.equal(G.refill(g,monday+10*G.RULES.refillMs),25);g.energy.count=0;g.energy.at=monday+1000;assert.equal(G.refill(g,monday),0);assert.equal(g.energy.at,monday);
});
test('older unlimited saves receive one migration to 25, without restoring on every visit',()=>{
 const g=G.create(monday);g.energy={count:0,at:monday};g.premiumDemoUntil=monday+9999999;assert.equal(G.refill(g,monday),25);G.reserve(g,monday);assert.equal(G.refill(g,monday),20);assert.equal(G.unlimited(g,monday),false);
});
test('unfinished activity refunds 5; rewarded completion grants 5 without exceeding 25',()=>{
 const g=G.create(monday);G.reserve(g,monday);assert.equal(g.energy.count,20);G.refund(g,monday);assert.equal(g.energy.count,25);G.reserve(g,monday);assert.equal(G.rewardEnergy(g,monday),5);assert.equal(G.rewardEnergy(g,monday),0);
});
test('a completion credits the week at completion time after a boundary', () => {
  const g = G.create(monday); G.credit(g, 200, monday);
  G.credit(g, 20, nextMonday); assert.equal(g.belt, 1); assert.equal(G.current(g).xp, 20);
  assert.equal(g.history[0].xp, 200);
});
