// Captures App Store screenshots of the real game at the sizes App Store Connect asks for.
//   npm run screenshots   →   store/screenshots/<device>/NN-name.jpg
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/logic.mjs';
import { launch, serve, sleep } from './lib/browser.mjs';

const DEVICES = [
  // 6.9" iPhone: 1290 × 2796 (430 × 932 pt @3x)
  { dir: 'iphone-6.9', viewport: { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, insets: { top: 59, right: 0, bottom: 34, left: 0 } },
  // 13" iPad: 2048 × 2732 (1024 × 1366 pt @2x)
  { dir: 'ipad-13', viewport: { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, insets: { top: 24, right: 0, bottom: 20, left: 0 } },
];
const SAVE = { v: 1, stars: { 0: 3, 1: 3, 2: 2, 3: 3, 4: 2, 5: 3, 6: 1 }, best: {}, level: 6, howto: true, settings: { sound: false, haptics: true, playback: 10 } };

// Each scene runs in the page; `PC` and the game's top-level functions are globals there.
const SCENES = [
  ['plan', async page => {
    await page.evaluate(() => PC.setLevel(6));
    await page.waitForFunction(() => PC.optimal);
    await sleep(2600);
    await page.evaluate(() => addNodes(PC.optimal.path.slice(1, Math.ceil(PC.optimal.path.length * 0.62))));
    await sleep(1800);
  }],
  ['drive', async page => {
    await page.evaluate(() => PC.setLevel(5));
    await page.waitForFunction(() => PC.optimal);
    await sleep(2600);
    await page.evaluate(() => { PC.planBest(); });
    await sleep(2200);
    await page.evaluate(() => PC.freezeDrive(0.58));
    await sleep(1600);
  }],
  ['best-route', async page => {
    await page.evaluate(() => PC.setLevel(8));
    await page.waitForFunction(() => PC.optimal);
    await sleep(2600);
    await page.evaluate(() => {   // a natural first attempt: nearest houses by distance, then show the solver's line
      for (const h of PC.level.houses) { const p = pathTo(h); if (p) addNodes(p.slice(1)); }
      document.querySelector('#bHint').click();
    });
    await sleep(2400);
  }],
  ['result', async page => {
    await page.evaluate(() => PC.setLevel(2));
    await page.waitForFunction(() => PC.optimal);
    await sleep(2600);
    await page.evaluate(() => { PC.planBest(); });
    await sleep(1600);
    await page.evaluate(() => PC.freezeDrive(1));
    await page.waitForSelector('#result:not(.hidden)');
    await sleep(1600);
  }],
  ['levels', async page => {
    await page.evaluate(() => PC.setLevel(6));
    await sleep(2600);
    await page.evaluate(() => document.querySelector('#bLevels').click());
    await sleep(900);
  }],
];

const browser = await launch();
const server = await serve(path.join(ROOT, 'web'));
try {
  for (const device of DEVICES) {
    const outDir = path.join(ROOT, 'store', 'screenshots', device.dir);
    fs.mkdirSync(outDir, { recursive: true });
    for (const [i, [name, run]] of SCENES.entries()) {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument((insets, save) => {
        window.__PC_NATIVE__ = { insets, save, version: '1.0.0', build: '1', platform: 'ios', dev: false };
      }, device.insets, SAVE);
      await page.setViewport(device.viewport);
      await page.goto(server.url + 'index.html');
      await page.waitForFunction(() => window.PC && PC.level);
      await run(page);
      const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}-${name}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 95 });   // JPEG: App Store screenshots must not have an alpha channel
      console.log(path.relative(ROOT, file));
      await page.close();
    }
  }
} finally {
  await server.close();
  await browser.close();
}
