// End-to-end smoke test of web/index.html in headless Chrome with touch input, phone/tablet layouts,
// the background solver, persistence and the native-shell bridge contract.
//   npm run smoke
import path from 'node:path';
import { ROOT } from './lib/logic.mjs';
import { launch, serve, sleep } from './lib/browser.mjs';

let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${extra ? ` (${extra})` : ''}`);
  if (!ok) failures++;
};

const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const LAYOUTS = [
  ['iPhone SE', { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { top: 20, bottom: 0 }],
  ['iPhone 16', PHONE, { top: 47, bottom: 34 }],
  ['iPhone 16 Pro Max', { width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, { top: 62, bottom: 34 }],
  ['iPad portrait', { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { top: 24, bottom: 20 }],
  ['iPad landscape', { width: 1180, height: 820, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { top: 24, bottom: 20 }],
  ['iPad split view', { width: 507, height: 820, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { top: 24, bottom: 20 }],
];

// Every visible crossing must sit between the HUD rows and inside the screen.
const layoutProbe = () => {
  const r = s => document.querySelector(s).getBoundingClientRect();
  const top = Math.max(r('#hudTL').bottom, r('.dial').bottom), barTop = r('#bar').top;
  const pts = PC.level.nodes.filter(n => !n.hidden).map(n => PC.toScreen(n.id));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return {
    ok: Math.min(...ys) > top && Math.max(...ys) < barTop && Math.min(...xs) > 0 && Math.max(...xs) < innerWidth,
    flip: PC.level.flip, block: Math.round(CFG.spacing * PC.view.s),
  };
};

const browser = await launch();
const server = await serve(path.join(ROOT, 'web'));
try {
  // ---------- 1. browser play-through with touch ----------
  console.log('Play-through (touch, iPhone-sized viewport)');
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport(PHONE);
  await page.goto(server.url + 'index.html');
  await page.waitForFunction(() => window.PC && PC.level);

  check(await page.$eval('#howto', el => !el.classList.contains('hidden')), 'how-to card on first launch');
  await page.tap('#bHowtoOk');
  check(await page.$eval('#howto', el => el.classList.contains('hidden')), 'how-to dismissed');

  await page.waitForFunction(() => PC.optimal, { timeout: 3000 });
  check(await page.evaluate(() => PC.solvedBy) === 'precomputed', 'level 1 best route is precomputed');
  check(await page.evaluate(() => PC.level.flip), 'wide map is transposed for a portrait phone');
  await sleep(1500);   // intro animation

  const order = await page.evaluate(() => PC.optimal.deliveries.map(d => PC.level.houses[d.house]));
  for (const node of order) {
    const p = await page.evaluate(id => PC.toScreen(id), node);
    await page.touchscreen.tap(p.x, p.y);
    await sleep(120);
  }
  check(await page.evaluate(() => PC.evalR.complete), 'tapping the houses builds a complete route');
  check(await page.$eval('#bGo', b => !b.disabled && b.classList.contains('ready')), 'deliver button is enabled and pulsing');

  await page.tap('#bGo');
  await sleep(300);
  check(await page.evaluate(() => PC.phase) === 'drive', 'courier drives');
  await page.tap('#bGo');   // skip to the end
  await page.waitForSelector('#result:not(.hidden)', { timeout: 5000 });
  const stars = await page.$$eval('#result .stars .on', els => els.length);
  check(stars >= 1, 'result card with stars', `${stars}★`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pizzaCourier.save')));
  check(saved && saved.stars[0] === stars && saved.best[0] > 0, 'progress saved', JSON.stringify(saved.stars));

  await page.tap('#rNext');
  check(await page.evaluate(() => PC.levelIdx) === 1, 'Next opens level 2');
  await page.waitForFunction(() => PC.optimal, { timeout: 3000 });
  await sleep(1500);

  // drag from the pizzeria to a neighbouring crossing
  const drag = await page.evaluate(() => {
    const pz = PC.level.pizzeria, to = PC.level.adj[pz][0].to;
    return { from: PC.toScreen(pz), to: PC.toScreen(to), id: to };
  });
  await page.touchscreen.touchStart(drag.from.x, drag.from.y);
  for (let k = 1; k <= 10; k++) {
    await page.touchscreen.touchMove(drag.from.x + (drag.to.x - drag.from.x) * k / 10, drag.from.y + (drag.to.y - drag.from.y) * k / 10);
    await sleep(16);
  }
  await page.touchscreen.touchEnd();
  const path1 = await page.evaluate(() => PC.evalR.path.slice());
  check(path1.length === 2 && path1[1] === drag.id, 'dragging snaps the line onto the next crossing');
  await page.tap('#bUndo');
  check(await page.evaluate(() => PC.evalR.path.length) === 1, 'undo removes the segment');

  await page.tap('#bLevels');
  const locked = await page.$$eval('#levelsGrid .lv', els => els.map(b => b.disabled));
  check(locked.filter(Boolean).length === 8 && !locked[0] && !locked[1], 'levels 3-9 and random mode are locked', `${locked.filter(Boolean).length} locked`);
  await page.keyboard.press('Escape');

  // random map → solved in the Web Worker while frames keep flowing
  await page.evaluate(() => {
    window.__gap = 0; let last = performance.now();
    (function tick(t) { window.__gap = Math.max(window.__gap, t - last); last = t; if (!PC.optimal || window.__gap === 0) requestAnimationFrame(tick); })(last);
    randomMap(8);
  });
  const t0 = Date.now();
  await page.waitForFunction(() => PC.optimal, { timeout: 60000 });
  const how = await page.evaluate(() => PC.solvedBy), gap = await page.evaluate(() => Math.round(window.__gap));
  check(how === 'worker', 'random map solved in the background worker', `${Date.now() - t0} ms`);
  check(gap < 250, 'no long frame stall while solving', `longest frame gap ${gap} ms`);

  await page.tap('#bSettings');
  await page.click('#sSound + .sw');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('pizzaCourier.save')).settings.sound) === false, 'sound toggle is saved');
  await page.keyboard.press('Escape');

  await page.reload();
  await page.waitForFunction(() => window.PC && PC.level);
  check(await page.evaluate(() => PC.levelIdx) === 1, 'reload resumes the last numbered level');
  check(await page.$eval('#howto', el => el.classList.contains('hidden')), 'how-to not shown again');
  check(errors.length === 0, 'no console errors', errors.join(' | '));
  await page.close();

  // ---------- 2. layouts ----------
  console.log('Layouts (all 9 levels must fit between the HUD rows)');
  for (const [name, viewport, insets] of LAYOUTS) {
    const p = await browser.newPage();
    await p.evaluateOnNewDocument(ins => { window.__PC_NATIVE__ = { insets: { ...ins, left: 0, right: 0 }, save: { howto: true }, version: '1.0.0', build: '1', dev: false }; }, insets);
    await p.setViewport(viewport);
    await p.goto(server.url + 'index.html');
    await p.waitForFunction(() => window.PC && PC.level);
    const results = [];
    for (let i = 0; i < 9; i++) { await p.evaluate(k => PC.setLevel(k), i); results.push(await p.evaluate(layoutProbe)); }
    const bad = results.map((r, i) => r.ok ? null : i + 1).filter(Boolean);
    const blocks = results.map(r => r.block);
    check(bad.length === 0, name, `block ${Math.min(...blocks)}-${Math.max(...blocks)} px, transposed: ${results.filter(r => r.flip).length}/9${bad.length ? `, overlaps on levels ${bad}` : ''}`);
    await p.close();
  }

  // ---------- 3. native shell contract ----------
  console.log('Native bridge contract (window.__PC_NATIVE__ in, postMessage out)');
  const nat = await browser.newPage();
  await nat.evaluateOnNewDocument(() => {
    window.__msgs = [];
    window.ReactNativeWebView = { postMessage: m => window.__msgs.push(JSON.parse(m)) };
    window.__PC_NATIVE__ = {
      save: { v: 1, stars: { 0: 3, 1: 2, 2: 1 }, best: {}, level: 3, howto: true, settings: { sound: false, haptics: true, playback: 12 } },
      insets: { top: 59, right: 0, bottom: 34, left: 0 }, version: '1.0.0', build: '7', platform: 'ios', dev: false,
    };
  });
  await nat.setViewport(PHONE);
  await nat.goto(server.url + 'index.html');
  await nat.waitForFunction(() => window.__msgs.some(m => m.type === 'ready'), { timeout: 3000 });
  check(true, "posts 'ready' after the first frame");
  check(await nat.evaluate(() => PC.levelIdx) === 3, 'resumes the level from the injected save');
  check(await nat.evaluate(() => Math.round(document.querySelector('#hudTL').getBoundingClientRect().top)) === 59 + 18, 'HUD respects injected safe-area insets');
  await nat.evaluate(() => PC.fromNative({ insets: { top: 20, right: 0, bottom: 0, left: 0 } }));
  check(await nat.evaluate(() => Math.round(document.querySelector('#hudTL').getBoundingClientRect().top)) === 20 + 18, 'inset updates from the shell are applied');
  check(await nat.$eval('#ver', el => el.textContent) === 'Version 1.0.0 (7)', 'settings shows the app version');
  check(await nat.$eval('#hapticsRow', el => !el.classList.contains('hidden')), 'haptics toggle offered inside the app');
  check(await nat.$eval('#dev', el => el.classList.contains('hidden')), 'dev tuning hidden in release');
  await nat.waitForFunction(() => PC.optimal, { timeout: 3000 });
  await sleep(1500);
  await nat.evaluate(() => PC.planBest());
  await sleep(200);
  const kinds = await nat.evaluate(() => [...new Set(window.__msgs.filter(m => m.type === 'haptic').map(m => m.kind))]);
  check(kinds.includes('selection') && kinds.includes('light'), 'haptics requested while drawing', kinds.join(','));
  await nat.evaluate(() => { PC.freezeDrive(1); });
  await nat.waitForSelector('#result:not(.hidden)', { timeout: 5000 });
  const last = await nat.evaluate(() => window.__msgs.filter(m => m.type === 'save').pop());
  check(last && last.data.stars[3] === 3 && last.data.settings.playback === 12, 'save posted to the shell after a level', JSON.stringify(last && last.data.stars));
  check(await nat.evaluate(() => !window.__msgs.some(m => m.type === 'error')), 'no errors reported to the shell');
  await nat.close();
} finally {
  await server.close();
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
