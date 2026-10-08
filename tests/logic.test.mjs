// Unit tests for the game's pure logic block, run in Node:  npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSolutions, loadLogic, readGameHtml, readSolutions } from '../scripts/lib/logic.mjs';

const html = readGameHtml();
const L = loadLogic(html);
const levels = L.LEVELS.map(def => L.genLevel(def));

test('there are 9 levels and each generates deterministically', () => {
  assert.equal(L.LEVELS.length, 9);
  L.LEVELS.forEach((def, i) => {
    const again = L.genLevel(def);
    assert.equal(again.seed, levels[i].seed);
    assert.deepEqual(again.houses, levels[i].houses);
    assert.deepEqual(again.edges.map(e => [e.a, e.b, e.type]), levels[i].edges.map(e => [e.a, e.b, e.type]));
  });
});

test('every level is a valid, connected city with the right number of orders', () => {
  levels.forEach((lv, i) => {
    const def = L.LEVELS[i];
    assert.equal(lv.houses.length, def.orders, `${def.name}: orders`);
    assert.equal(new Set(lv.houses).size, lv.houses.length, `${def.name}: distinct houses`);
    assert.ok(!lv.houses.includes(lv.pizzeria), `${def.name}: pizzeria is not a house`);
    for (const id of [lv.pizzeria, ...lv.houses]) assert.ok(!lv.nodes[id].hidden, `${def.name}: stop on a hidden node`);
    for (const n of lv.nodes) if (!n.hidden) assert.ok(lv.adj[n.id].length >= 2, `${def.name}: dead end at ${n.id}`);
    const seen = new Set([lv.pizzeria]), stack = [lv.pizzeria];
    while (stack.length) for (const { to } of lv.adj[stack.pop()]) if (!seen.has(to)) { seen.add(to); stack.push(to); }
    assert.equal(seen.size, lv.nodes.filter(n => !n.hidden).length, `${def.name}: connected`);
  });
});

test('features appear where the level ladder says', () => {
  levels.forEach((lv, i) => {
    const def = L.LEVELS[i];
    assert.equal(!!lv.river, !!def.river, `${def.name}: river`);
    // The generator places parks only where they fit; Friday Night asks for 2 but its city has room for 1.
    if (def.parks) assert.ok(lv.parks.length >= 1 && lv.parks.length <= def.parks, `${def.name}: parks`);
    else assert.equal(lv.parks.length, 0, `${def.name}: parks`);
    assert.equal(!!lv.old, !!def.oldTown, `${def.name}: old town`);
    assert.equal(lv.edges.some(e => e.a % lv.cols !== e.b % lv.cols && Math.floor(e.a / lv.cols) !== Math.floor(e.b / lv.cols)), !!def.diag, `${def.name}: diagonal`);
  });
});

test('physics: segment profile is consistent and corners slow you down', () => {
  const s = L.makeSeg(100, 0, 0, 40 / 3.6);
  const end = L.segAt(s, s.t);
  assert.ok(Math.abs(end.d - 100) < 1e-6, 'covers the whole segment');
  assert.ok(Math.abs(end.v) < 1e-6, 'ends at rest');
  const short = L.makeSeg(10, 0, 0, 70 / 3.6);
  assert.ok(short.vp < 70 / 3.6, 'short segment never reaches the cap');
  assert.equal(L.cornerFactor(0), 1);
  assert.ok(Math.abs(L.cornerFactor(Math.PI / 2) - Math.cos(Math.PI / 4) ** 3) < 1e-12, '90° corner');
  assert.ok(L.cornerFactor(Math.PI) < 1e-4, 'U-turn is near zero');
});

test('the solver beats or matches a naive route on every level, and its time is exact', () => {
  levels.forEach((lv, i) => {
    const best = L.solve(lv);
    assert.ok(best.complete, `${L.LEVELS[i].name}: complete`);
    assert.equal(best.total, L.evalRoute(lv, best.path).total);
    let path = [lv.pizzeria];
    for (const h of lv.houses) path = path.concat(L.shortestByLength(lv, path[path.length - 1], h).slice(1));
    assert.ok(best.total <= L.evalRoute(lv, path).total + 1e-9, `${L.LEVELS[i].name}: best ≤ naive`);
  });
});

test('transposing the map (portrait layout) does not change any time', () => {
  levels.forEach(lv => {
    const best = L.solve(lv);
    const flipped = { ...lv, nodes: lv.nodes.map(n => ({ ...n, x: n.y, y: n.x })) };
    assert.ok(Math.abs(L.evalRoute(flipped, best.path).total - best.total) < 1e-9);
  });
});

test('random maps generate for many seeds (endless mode)', () => {
  for (const base of [L.LEVELS[0], L.LEVELS[4], L.LEVELS[8]]) {
    for (let k = 0; k < 150; k++) {
      const lv = L.genLevel({ ...base, seed: 1000 + k * 7919 });
      assert.equal(lv.houses.length, base.orders);
    }
  }
});

test('embedded level solutions in web/index.html are up to date (run `npm run solve` if not)', () => {
  assert.equal(JSON.stringify(readSolutions(html)), JSON.stringify(computeSolutions(L)));   // JSON: vm arrays have another realm
});
