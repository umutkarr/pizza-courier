// Renders the app icon, splash mark, Android adaptive layers and favicon from the game's own shapes and palette.
//   npm run icons
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/logic.mjs';
import { launch } from './lib/browser.mjs';
import { encodePng } from './lib/png.mjs';

const C = { bg: '#f3efe5', ink: '#2b2b2b', route: '#e8473a', road: '#ddd5c3', crust: '#f5b942', crustEdge: '#c9772b', pep: '#d9472b' };

const slice = (cx, cy, s) => `<g transform="translate(${cx} ${cy})">
  <path d="M0 ${s} L${-0.85 * s} ${-0.55 * s} Q0 ${-1.1 * s} ${0.85 * s} ${-0.55 * s} Z" fill="${C.crust}" stroke="${C.crustEdge}" stroke-width="${s * 0.17}" stroke-linejoin="round"/>
  <circle cx="${-0.18 * s}" cy="${-0.22 * s}" r="${0.17 * s}" fill="${C.pep}"/>
  <circle cx="${0.2 * s}" cy="${0.12 * s}" r="${0.14 * s}" fill="${C.pep}"/></g>`;
// same proportions as the in-game pizzeria: 34px square, radius 10, 4px outline, slice of size 9
const pizzeria = (cx, cy, size, { mono = false } = {}) => {
  const h = size / 2, sw = size * 0.118;
  return mono
    ? `<rect x="${cx - h}" y="${cy - h}" width="${size}" height="${size}" rx="${size * 0.29}" fill="none" stroke="#fff" stroke-width="${sw * 1.4}"/>`
    : `<rect x="${cx - h}" y="${cy - h}" width="${size}" height="${size}" rx="${size * 0.29}" fill="#fff" stroke="${C.ink}" stroke-width="${sw}"/>` +
      slice(cx, cy + size * 0.03, size * 0.265);
};
const triangle = (cx, cy, r) => {
  const pts = [0, 1, 2].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return [cx + 1.3 * r * Math.cos(a), cy + 1.3 * r * Math.sin(a) + 0.2 * r]; });
  return `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="#fff" stroke="${C.ink}" stroke-width="${r * 0.33}" stroke-linejoin="round"/>`;
};

// The scene, in a 1024 box: pizzeria → courier → rounded bend → house, on a quiet road grid.
const scene = ({ roads = true, mono = false } = {}) => {
  const ink = mono ? '#fff' : C.ink;
  return [
    roads && `<g stroke="${C.road}" stroke-width="44">
      <path d="M-40 300H1064M-40 744H1064M260 -40V1064M764 -40V1064"/></g>`,
    roads && triangle(260, 744, 56),
    `<path d="M260 300H644A120 120 0 0 1 764 420V744" fill="none" stroke="${mono ? '#fff' : C.route}" stroke-width="76" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="764" cy="744" r="70" fill="${mono ? 'none' : '#fff'}" stroke="${ink}" stroke-width="${mono ? 30 : 22}"/>`,
    pizzeria(260, 300, 240, { mono }),
    !mono && `<g transform="translate(520 300)"><rect x="-60" y="-35" width="120" height="70" rx="20" fill="${C.ink}"/>
      <rect x="-25" y="-20" width="40" height="40" fill="${C.bg}"/></g>`,
  ].filter(Boolean).join('\n');
};
const svg = (size, body, { bg = null, view = '0 0 1024 1024' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${view}">` +
  (bg ? `<rect x="-2000" y="-2000" width="5000" height="5000" fill="${bg}"/>` : '') + body + '</svg>';
// fit the scene (content box ≈ 140..834 × 180..814) into the middle of an Android adaptive-icon safe zone
const centred = (frac, body) => {
  const k = (1024 * frac) / 694, tx = 512 - 487 * k, ty = 512 - 497 * k;
  return `<g transform="translate(${tx} ${ty}) scale(${k})">${body}</g>`;
};

const OUT = [
  { file: 'icon.png', size: 1024, alpha: false, svg: s => svg(s, scene(), { bg: C.bg }) },
  { file: 'splash-icon.png', size: 1024, svg: s => svg(s, pizzeria(512, 512, 600)) },
  { file: 'android-icon-foreground.png', size: 512, svg: s => svg(s, centred(0.58, scene({ roads: false }))) },
  { file: 'android-icon-background.png', size: 512, svg: s => svg(s, '', { bg: C.bg }) },
  { file: 'android-icon-monochrome.png', size: 432, svg: s => svg(s, centred(0.58, scene({ roads: false, mono: true }))) },
  { file: 'favicon.png', size: 48, svg: s => svg(s, scene(), { bg: C.bg }) },
];

const browser = await launch();
try {
  const page = await browser.newPage();
  for (const out of OUT) {
    const b64 = await page.evaluate(async (markup, size) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
      await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, size, size);
      const px = g.getImageData(0, 0, size, size).data;
      let bin = ''; for (let i = 0; i < px.length; i += 0x8000) bin += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
      return btoa(bin);
    }, out.svg(out.size), out.size);
    const png = encodePng(out.size, out.size, Buffer.from(b64, 'base64'), { alpha: out.alpha !== false });
    fs.writeFileSync(path.join(ROOT, 'assets', out.file), png);
    console.log(`assets/${out.file}  ${out.size}×${out.size}${out.alpha === false ? ' (no alpha)' : ''}`);
  }
} finally {
  await browser.close();
}
