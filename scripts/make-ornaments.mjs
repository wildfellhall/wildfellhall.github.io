// Local, deterministic vector design and rasterization. No image services.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import sharp from 'sharp';

const out = new URL('../public/ornaments/', import.meta.url);
await mkdir(out, { recursive: true });
const bytes = await readFile(new URL('../node_modules/@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff', import.meta.url));
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const letters = new opentype.Path();
const glyphs = [...'Wildfell Hall'].map(character => font.charToGlyph(character));
let pen = 0;
for (let i = 0; i < glyphs.length; i++) {
  letters.extend(glyphs[i].getPath(pen, 0, 160));
  pen += (glyphs[i].advanceWidth + (glyphs[i + 1] ? font.getKerningValue(glyphs[i], glyphs[i + 1]) : 0)) * 160 / font.unitsPerEm;
}
const bounds = letters.getBoundingBox();
const name = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x1 - 3} ${bounds.y1 - 3} ${bounds.x2 - bounds.x1 + 6} ${bounds.y2 - bounds.y1 + 6}" fill="#ba8d36"><title>Wildfell Hall</title>${letters.toSVG({ flipY: false }).replace('fill="black"', '')}</svg>`;
await writeFile(new URL('wildfell-hall.svg', out), name);
await writeFile(new URL('great-vibes-OFL.txt', out), await readFile(new URL('../node_modules/@fontsource/great-vibes/LICENSE', import.meta.url)));

const W = 2400, H = 2000;
const parts = [];
const use = (id, x, y, scale = 1, angle = 0) => `<use href="#${id}" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"/>`;
const ring = (x, y, radius, count, id, scale = 1) => Array.from({ length: count }, (_, i) => {
  const angle = i / count * Math.PI * 2;
  return use(id, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, scale, i * 360 / count + 90);
}).join('');
const defs = `<defs>
  <g id="leaf" fill="#c09b9e" stroke="#a88087" stroke-width="1.2">
    <path d="M0 0C-22-4-33-26-27-47C-7-43 9-24 0 0Z"/>
    <path d="M0 0Q-16-22-27-47" fill="none" stroke="#f5dfd8"/>
  </g>
  <g id="petal" fill="#f6e7dd" stroke="#bb8194" stroke-width="1.5">
    <path d="M0 0C-34-13-26-40-12-35C-19-56 16-61 13-36C31-39 35-12 0 0Z"/>
    <path d="M0-5Q-2-28 1-41" fill="none" stroke="#dbb2bc"/>
  </g>
  <g id="rose">${Array.from({ length: 9 }, (_, i) => `<use href="#petal" transform="rotate(${i * 40})"/>`).join('')}
    <circle r="14" fill="#d5a0b1" stroke="#faf0e5" stroke-width="3"/>
    <path d="M-5 7C-23-6-3-20 10-8C22 7 0 21-7 9C-14-5 6-10 8 0C10 8 0 11-3 4" fill="none" stroke="#a96881" stroke-width="2"/>
    <circle r="3" fill="#f6e6d2"/>
  </g>
  <g id="sprig" stroke-linecap="round">
    <path d="M0 65C-73 5 48-14 8-83C-12-114-65-80-35-49C-14-31 9-62-9-69" fill="none" stroke="#b38d90" stroke-width="5"/>
    <path d="M0 65C-73 5 48-14 8-83C-12-114-65-80-35-49C-14-31 9-62-9-69" fill="none" stroke="#f6e3d9" stroke-width="2"/>
    ${use('leaf', -20, 32, .72, -45)}${use('leaf', -17, 7, .65, 90)}${use('leaf', 3, -24, .7, 125)}${use('leaf', 15, -53, .5, 82)}
    ${use('rose', -11, -91, .38)}
  </g>
  <g id="bouquet">
    ${use('sprig', -16, 24, .85, -31)}${use('sprig', 16, 24, .85, 31)}
    ${use('leaf', -9, 19, .95, -60)}${use('leaf', 9, 19, .95, 92)}
    ${use('rose', 0, -9, .86)}${use('rose', -53, 29, .36)}${use('rose', 53, 29, .36)}
    <path d="M-24 66Q0 46 24 66Q0 83-24 66Z" fill="#f3e1d4" stroke="#b68d93" stroke-width="2"/>
  </g>
  <g id="palmette" fill="#f4e3d9" stroke="#ba8b9b" stroke-width="1.7">
    <path d="M0 38C-7 17-64 17-48-22C-31-14-25 3-15 10C-35-23-25-44-11-45C-8-32-8-12 0 0C8-12 8-32 11-45C25-44 35-23 15 10C25 3 31-14 48-22C64 17 7 17 0 38Z"/>
    <path d="M0 33V0M-5 26Q-27 13-40-11M5 26Q27 13 40-11" fill="none"/>
  </g>
  <pattern id="garden" width="280" height="320" patternUnits="userSpaceOnUse">
    <rect width="280" height="320" fill="#edd1d7"/>
    <path d="M0 160Q70 87 140 160T280 160M140 0Q210 80 140 160T140 320" fill="none" stroke="#dfbac5" stroke-width="2"/>
    ${use('bouquet', 140, 160, .86)}${use('rose', 0, 0, .40)}${use('rose', 280, 0, .40)}${use('rose', 0, 320, .40)}${use('rose', 280, 320, .40)}
    ${use('palmette', 0, 160, .42, 90)}${use('palmette', 280, 160, .42, -90)}
    <circle cx="140" cy="15" r="3" fill="#b28693"/><circle cx="140" cy="305" r="3" fill="#b28693"/>
  </pattern>
  <pattern id="guard" width="50" height="50" patternUnits="userSpaceOnUse">
    <rect width="50" height="50" fill="#f2ddd8"/>
    <path d="M25 3 47 25 25 47 3 25Z" fill="none" stroke="#c495a4" stroke-width="2"/>
    ${use('rose', 25, 25, .15)}
  </pattern>
</defs>`;
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`);
parts.push('<rect width="2400" height="2000" fill="#c896a7"/>');
parts.push('<rect x="10" y="10" width="2380" height="1980" rx="4" fill="url(#guard)" stroke="#f8e9de" stroke-width="5"/>');
parts.push('<rect x="54" y="54" width="2292" height="1892" fill="#deb5c3" stroke="#b9899a" stroke-width="5"/>');
parts.push('<rect x="68" y="68" width="2264" height="1864" fill="none" stroke="#f6e3dc" stroke-width="5"/>');
// Broad floral border; repeated motifs are individually rotated like woven tiles.
for (let x = 130; x <= 2280; x += 128) {
  parts.push(use('rose', x, 128, .69), use('sprig', x + 63, 128, .46, 90));
  parts.push(use('rose', x, 1872, .69), use('sprig', x + 63, 1872, .46, -90));
}
for (let y = 255; y <= 1790; y += 128) {
  parts.push(use('rose', 128, y, .69), use('sprig', 128, y + 63, .46));
  parts.push(use('rose', 2272, y, .69), use('sprig', 2272, y + 63, .46, 180));
}
parts.push('<rect x="196" y="196" width="2008" height="1608" fill="url(#guard)" stroke="#f7e9de" stroke-width="5"/>');
parts.push('<rect x="232" y="232" width="1936" height="1536" fill="url(#garden)" stroke="#c89ca9" stroke-width="4"/>');
parts.push('<rect x="246" y="246" width="1908" height="1508" fill="none" stroke="#faf0e3" stroke-width="3"/>');
// Scalloped central medallion and quarter-medallion corner bouquets.
for (const [x, y, angle] of [[300, 300, -45], [2100, 300, 45], [300, 1700, -135], [2100, 1700, 135]]) {
  parts.push(use('bouquet', x, y, 1.6, angle));
}
parts.push('<ellipse cx="1200" cy="1000" rx="343" ry="420" fill="#e3bac8" stroke="#f6e5d8" stroke-width="12"/>');
parts.push('<ellipse cx="1200" cy="1000" rx="324" ry="400" fill="#f0d9dc" stroke="#ba8b9d" stroke-width="3"/>');
parts.push(ring(1200, 1000, 240, 16, 'palmette', 1));
parts.push(ring(1200, 1000, 167, 12, 'sprig', .75));
parts.push(ring(1200, 1000, 100, 8, 'rose', .52));
parts.push(use('rose', 1200, 1000, 1.7));
parts.push('</svg>');
const svg = parts.join('');
await writeFile(new URL('rose-carpet.svg', out), svg);

// Warp and weft, pile variation, and gentle dye abrasion are baked into the maps.
const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const height = Buffer.alloc(info.width * info.height);
let seed = 1886;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  const p = y * info.width + x, i = p * 4;
  const thread = Math.sin(x * Math.PI) * 1.7 + ((x + y) % 3 === 0 ? -3 : 1.3);
  const fibers = (random() - .5) * 12;
  const abrash = Math.sin(y * .048) * 1.5 + Math.sin(y * .011 + Math.sin(x * .003)) * 1.3;
  const faded = .025 + (Math.sin(x * .006 + 1) * Math.sin(y * .004) + 1) * .025;
  for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, data[i + c] * (1 - faded) + [248, 230, 224][c] * faded + thread + fibers + abrash));
  height[p] = Math.max(0, Math.min(255, 133 + thread * 9 + fibers * 3));
}
await sharp(data, { raw: info }).webp({ quality: 92 }).toFile(new URL('../materials/rose-carpet-color.webp', out).pathname);
await sharp(height, { raw: { width: W, height: H, channels: 1 } }).resize(1200, 1000).webp({ quality: 87 }).toFile(new URL('../materials/rose-carpet-height.webp', out).pathname);
await sharp(data, { raw: info }).resize(1200, 1000).webp({ quality: 87 }).toFile(new URL('../materials/rose-carpet-fallback.webp', out).pathname);
console.log('Built cursive lettering and ornate woven rose carpet.');
