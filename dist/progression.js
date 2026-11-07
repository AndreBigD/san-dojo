(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DojoGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RULES = Object.freeze({ promoteXP: 200, maintainXP: 80, unlimitedEnergy: false, maxEnergy: 25, activityEnergy: 5, refillEnergy: 5, rewardEnergy: 5, energyVersion: 2, refillMs: 30 * 60 * 1000, lessonXP: 20, timezone: 'America/Sao_Paulo' });
  const BELTS = Object.freeze([
    { name: 'Branca', color: '#f9f8ef', stripe: null },
    { name: 'Branca com risco laranja', color: '#f9f8ef', stripe: '#f18135' },
    { name: 'Laranja', color: '#f18135', stripe: null },
    { name: 'Laranja ponta azul', color: '#f18135', stripe: '#4785bf' },
    { name: 'Azul', color: '#4785bf', stripe: null },
    { name: 'Azul ponta amarela', color: '#4785bf', stripe: '#f0cd50' },
    { name: 'Amarela', color: '#f0cd50', stripe: null },
    { name: 'Amarela ponta verde', color: '#f0cd50', stripe: '#43866b' },
    { name: 'Verde', color: '#43866b', stripe: null },
    { name: 'Verde ponta marrom', color: '#43866b', stripe: '#936246' },
    { name: 'Marrom', color: '#936246', stripe: null },
    { name: 'Marrom ponta preta', color: '#936246', stripe: '#28323c' },
    { name: 'Preta com risco dourado · 1º dan', color: '#28323c', stripe: '#e2b84c' }
  ]);
  function dayKey(now = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: RULES.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
    const pick = type => parts.find(p => p.type === type).value;
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  }
  function shiftDay(key, days) {
    const date = new Date(`${key}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function weekKey(now = Date.now()) {
    const day = dayKey(now);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    return shiftDay(day, -((weekday + 6) % 7));
  }
  function create(now = Date.now()) {
    return { version: 1, currentWeek: weekKey(now), belt: 0, highestBelt: 0, weeks: {}, history: [], energy: { version: RULES.energyVersion, count: RULES.maxEnergy, at: now }, premiumDemoUntil: 0 };
  }
  function unlimited(game, now = Date.now()) { return RULES.unlimitedEnergy; }
  function premium(game, now = Date.now()) { return Number(game.premiumDemoUntil) > now; }
  function current(game) { return game.weeks[game.currentWeek] || { xp: 0, days: [] }; }
  function outcome(belt, xp, eligible = true) {
    if (xp >= RULES.promoteXP && belt < BELTS.length - 1 && !eligible) return { belt, kind: 'awaiting_mastery' };
    if (xp >= RULES.promoteXP) return belt < BELTS.length - 1 ? { belt: belt + 1, kind: 'promoted' } : { belt, kind: 'maintained' };
    if (xp >= RULES.maintainXP) return { belt, kind: 'maintained' };
    return { belt: Math.max(0, belt - 1), kind: belt > 0 ? 'demoted' : 'starting' };
  }
  function reconcile(game, now = Date.now()) {
    const target = weekKey(now), settled = [];
    // Lexicographic comparison is safe for these ISO calendar dates.
    while (game.currentWeek < target) {
      const xp = current(game).xp;
      const eligible = !game.requireMastery || (game.masteryFromWeek && game.currentWeek < game.masteryFromWeek) || Boolean(game.mastery?.[game.belt]);
      const result = outcome(game.belt, xp, eligible);
      const item = { week: game.currentWeek, xp, from: game.belt, to: result.belt, kind: result.kind };
      game.history.push(item);
      settled.push(item);
      game.belt = result.belt;
      game.highestBelt = Math.max(game.highestBelt, game.belt);
      game.currentWeek = shiftDay(game.currentWeek, 7);
    }
    refill(game, now);
    return settled;
  }
  function refill(game, now = Date.now()) {
    const energy = game.energy;
    if(energy.version!==RULES.energyVersion){energy.version=RULES.energyVersion;energy.count=RULES.maxEnergy;energy.at=now;game.premiumDemoUntil=0;}
    if (RULES.unlimitedEnergy) { energy.count = RULES.maxEnergy; energy.at = now; return energy.count; }
    energy.count = Math.max(0, Math.min(RULES.maxEnergy, Math.floor(Number.isFinite(energy.count)?energy.count:0)));
    // A device clock moved backwards must not grant charges or stall recovery.
    if (!Number.isFinite(energy.at) || energy.at > now) energy.at = now;
    if (energy.count >= RULES.maxEnergy) { energy.at = now; return energy.count; }
    const recovered = Math.floor((now - energy.at) / RULES.refillMs);
    if (recovered > 0) {
      energy.count = Math.min(RULES.maxEnergy, energy.count + recovered * RULES.refillEnergy);
      energy.at = energy.count === RULES.maxEnergy ? now : energy.at + recovered * RULES.refillMs;
    }
    return energy.count;
  }
  function nextChargeMs(game, now = Date.now()) {
    refill(game, now);
    return game.energy.count === RULES.maxEnergy ? 0 : Math.max(0, RULES.refillMs - (now - game.energy.at));
  }
  function reserve(game, now = Date.now()) {
    reconcile(game, now);
    if (unlimited(game, now)) return { allowed: true, charged: false };
    if (game.energy.count < RULES.activityEnergy) return { allowed: false, charged: false };
    if (game.energy.count === RULES.maxEnergy) game.energy.at = now;
    game.energy.count -= RULES.activityEnergy;
    return { allowed: true, charged: true };
  }
  function refund(game, now = Date.now()) {
    refill(game, now);
    game.energy.count = Math.min(RULES.maxEnergy, game.energy.count + RULES.activityEnergy);
    if (game.energy.count === RULES.maxEnergy) game.energy.at = now;
  }
  function rewardEnergy(game, now = Date.now()) {refill(game,now);const before=game.energy.count;game.energy.count=Math.min(RULES.maxEnergy,before+RULES.rewardEnergy);if(game.energy.count===RULES.maxEnergy)game.energy.at=now;return game.energy.count-before;}
  function credit(game, xp, now = Date.now()) {
    reconcile(game, now);
    if (!Number.isFinite(xp) || xp < 0) throw new Error('Invalid XP');
    const entry = game.weeks[game.currentWeek] ||= { xp: 0, days: [] };
    entry.xp += xp;
    const day = dayKey(now);
    if (xp > 0 && !entry.days.includes(day)) entry.days.push(day);
    return entry;
  }
  return { RULES, BELTS, create, dayKey, weekKey, shiftDay, premium, unlimited, current, outcome, reconcile, refill, nextChargeMs, reserve, refund, rewardEnergy, credit };
});
