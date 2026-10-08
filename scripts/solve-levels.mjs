// Precomputes the solver's best route for every fixed level and stores it in web/index.html,
// so par times appear instantly on a phone instead of after seconds of solving.
//   node scripts/solve-levels.mjs          update the embedded solutions
//   node scripts/solve-levels.mjs --check  exit 1 if they are missing or stale
import fs from 'node:fs';
import { GAME_HTML, computeSolutions, loadLogic, readGameHtml, readSolutions, writeSolutions } from './lib/logic.mjs';

const check = process.argv.includes('--check');
const html = readGameHtml();
const t0 = performance.now();
const fresh = computeSolutions(loadLogic(html));
const secs = ((performance.now() - t0) / 1000).toFixed(1);

if (check) {
  let current = null;
  try { current = readSolutions(html); } catch {}
  if (JSON.stringify(current) !== JSON.stringify(fresh)) {
    console.error('Embedded level solutions are stale. Run `npm run solve`.');
    process.exit(1);
  }
  console.log(`Level solutions are up to date (${secs}s).`);
} else {
  fs.writeFileSync(GAME_HTML, writeSolutions(html, fresh));
  console.log(`Solved ${Object.keys(fresh.levels).length} levels in ${secs}s → web/index.html`);
}
