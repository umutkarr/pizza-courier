// Loads the pure game logic (the `LOGIC START … END` block of web/index.html) into Node.
// Hashing and keys here must match the platform section of web/index.html.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GAME_HTML = path.join(ROOT, 'web', 'index.html');

export const norm = s => s.replace(/\r\n?/g, '\n');
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
export const physicsSig = (P, CFG) => [P.vMax, P.a, P.b, P.harsh, CFG.K, CFG.returnHome].join();
export const defKey = (def, seed) =>
  [def.cols, def.rows, def.orders, def.parks || 0, !!def.river, !!def.diag, !!def.oldTown, def.bridges || 2, seed].join();

export function logicSource(html) {
  const s = norm(html), a = s.indexOf('// ===== LOGIC START'), b = s.indexOf('// ===== LOGIC END');
  if (a < 0 || b < a) throw new Error('LOGIC START/END markers not found in web/index.html');
  return s.slice(a, b);
}

export function readGameHtml() { return fs.readFileSync(GAME_HTML, 'utf8'); }

export function loadLogic(html = readGameHtml()) {
  const src = logicSource(html);
  const context = vm.createContext({});
  vm.runInContext(`${src}
this.api = { CFG, P, ROAD, LEVELS, mulberry32, genLevel, tryGenLevel, evalRoute, makeSeg, segAt,
  turnAngle, cornerFactor, getEdge, solve, kPaths, shortestByLength };`, context);
  return { src, hash: hashStr(src), ...context.api };
}

const SOLUTIONS_RE = /(<script type="application\/json" id="solutions">)([\s\S]*?)(<\/script>)/;
export function readSolutions(html) {
  const m = html.match(SOLUTIONS_RE);
  if (!m) throw new Error('solutions <script> block not found in web/index.html');
  return JSON.parse(m[2]);
}
export function writeSolutions(html, solutions) {
  return html.replace(SOLUTIONS_RE, (_, open, __, close) => open + JSON.stringify(solutions) + close);
}

// Best route for every fixed level, keyed the same way the game looks them up.
export function computeSolutions(L) {
  const levels = {};
  for (const def of L.LEVELS) {
    const level = L.genLevel(def), best = L.solve(level);
    levels[defKey(def, level.seed)] = best.path;
  }
  return { logic: L.hash, physics: physicsSig(L.P, L.CFG), levels };
}
