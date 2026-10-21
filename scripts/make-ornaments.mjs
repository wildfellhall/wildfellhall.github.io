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

const W = 2400, H = 1740;
const use = (id, x, y, scale = 1, angle = 0) => `<use href="#${id}" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"/>`;
const elements = [];
const defs = `<defs>
  <g id="leaf" fill="#9c9c83" stroke="#7e8271" stroke-width="1.1">
    <path d="M0 0C-5-13-22-12-25-24C-16-23-20-36-24-42C-7-37 4-20 0 0Z"/>
    <path d="M0 0Q-3-22-24-42M-4-16-16-22M-8-25-16-33" fill="none" stroke="#c7c2a4"/>
  </g>
  <g id="acanthus" fill="#d9cbb0" stroke="#aa9180" stroke-width="1.3">
    <path d="M0 0C-18-3-41-26-28-42C-22-34-18-28-14-26C-30-45-17-57-12-64C-8-49-7-35-3-30C-9-53 4-65 10-64C11-40 2-15 0 0Z"/>
    <path d="M0-4Q-4-31 10-64M-4-18Q-19-26-28-42M-4-27Q-13-42-12-64" fill="none" stroke="#b19b83"/>
  </g>
  <g id="rose" stroke="#aa8176" stroke-width="1.1">
    <path d="M0-22C8-27 14-19 14-15C24-17 28-6 20 1C28 8 19 22 11 17C8 29-6 27-10 20C-20 23-27 13-20 5C-30-1-22-15-15-14C-15-25-5-26 0-22Z" fill="#ddc5af"/>
    <path d="M0-15C16-18 20-1 11 6C6 19-11 17-14 4C-18-8-6-18 5-11C17-2 7 12-3 8C-14 3-6-10 2-5C9 0 2 7-3 2" fill="none" stroke="#b9877c" stroke-width="2"/>
    <path d="M-1-4Q5-3 3 2Q0 6-4 1Z" fill="#a9776b"/>
  </g>
  <g id="bud" fill="#c4a389" stroke="#988871" stroke-width="1.2">
    <path d="M0 5C-29-8-18-26-5-30C-4-18 0-14 2-13C8-25 19-24 19-18C20-5 9 0 0 5Z"/>
    <path d="M0 4Q-3-9-5-24M0 4Q8-5 15-15" fill="none"/>
  </g>
  <g id="spray">
    <path d="M0 48C-32 19 24-5 0-46C-15-68-41-44-30-27C-21-13-5-25-15-34" fill="none" stroke="#9c9880" stroke-width="3"/>
    ${use('leaf', -6, 30, .55, -48)}${use('leaf', -7, 12, .65, 103)}${use('acanthus', 4, -7, .55, 35)}${use('leaf', 3, -24, .46, 105)}${use('rose', -12, -52, .57)}
  </g>
  <g id="bouquet">
    ${use('spray', -18, 20, .8, -40)}${use('spray', 18, 20, .8, 40)}
    ${use('acanthus', -6, 10, .8, -66)}${use('acanthus', 6, 10, .8, 66)}
    ${use('rose', 0, -12, .85)}${use('rose', -31, 10, .48)}${use('rose', 32, 11, .48)}
    ${use('leaf', -2, 28, .7, 162)}${use('leaf', 2, 28, .7, 198)}
  </g>
  <pattern id="field" width="310" height="260" patternUnits="userSpaceOnUse">
    <rect width="310" height="260" fill="#cfa8a4"/>
    <path d="M0 130C45 130 60 30 155 0C250 30 265 130 310 130M0 130C45 130 60 230 155 260C250 230 265 130 310 130" fill="none" stroke="#d9bcb0" stroke-width="2"/>
    ${use('bouquet', 155, 130, .82)}${use('spray', 0, 130, .62, 90)}${use('spray', 310, 130, .62, -90)}
    ${use('bud', 155, 20, .56)}${use('bud', 155, 240, .56, 180)}
    ${use('leaf', 55, 65, .52, -50)}${use('leaf', 255, 195, .52, 130)}
  </pattern>
  <pattern id="guard" width="42" height="42" patternUnits="userSpaceOnUse">
    <rect width="42" height="42" fill="#b68f83"/>
    <path d="M0 21Q10 2 21 21T42 21" fill="none" stroke="#d5c5a8" stroke-width="2"/>
    <path d="M21 21Q12 18 17 9Q25 11 21 21M21 21Q30 24 25 33Q17 31 21 21" fill="#d8c9ad"/>
  </pattern>
</defs>`;
elements.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs}`);
elements.push(`<rect width="${W}" height="${H}" fill="#a48374"/>`);
function border(inset, fill, stroke = '#ab8e78', sw = 3) {
  elements.push(`<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
}
border(8, '#d7c4a6'); border(18, 'url(#guard)'); border(43, '#d9c9ae'); border(52, '#c3ad91'); border(65, '#e0cfb5');
// An interlaced vine border with alternating small floral sprays.
for (const [y, sign] of [[117, 1], [H - 117, -1]]) {
  for (let x = 114; x < W - 80; x += 112) {
    elements.push(`<path d="M${x - 56} ${y}Q${x - 28} ${y - sign * 35} ${x} ${y}T${x + 56} ${y}" fill="none" stroke="#9c9b80" stroke-width="3"/>`);
    elements.push(use('acanthus', x - 25, y + sign * 6, .65, sign * 50), use('rose', x + 28, y, .65), use('leaf', x + 5, y, .52, sign * -70));
  }
}
for (const [x, angle] of [[117, -90], [W - 117, 90]]) for (let y = 216; y < H - 170; y += 112) {
  elements.push(use('spray', x, y, .73, angle), use('rose', x, y + 56, .55));
}
border(171, 'url(#guard)'); border(197, '#d9c5a8'); border(204, 'url(#field)', '#a98c7e', 4);
// Woven corner spandrels, shaped into the field rather than pasted floral tiles.
for (const [x, y, a] of [[210, 210, 0], [W - 210, 210, 90], [W - 210, H - 210, 180], [210, H - 210, 270]]) {
  elements.push(`<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0H290C274 70 155 50 160 138C75 154 85 253 0 277Z" fill="#ddcdb3" stroke="#ad9180" stroke-width="3"/>${use('bouquet', 72, 70, 1.1, -45)}${use('spray', 34, 181, .8, -35)}${use('spray', 188, 29, .8, 75)}${use('rose', 125, 125, .65)}</g>`);
}
// Lobed ivory centre with fine, concentric acanthus and rose garlands.
const cx = W / 2, cy = H / 2;
let outline = '';
for (let i = 0; i <= 240; i++) {
  const a = i / 240 * Math.PI * 2, r = 1 + .045 * Math.cos(a * 12);
  outline += `${i ? 'L' : 'M'}${cx + Math.cos(a) * 340 * r} ${cy + Math.sin(a) * 430 * r}`;
}
elements.push(`<path d="${outline}Z" fill="#d8c7ac" stroke="#b1917e" stroke-width="5"/>`);
elements.push(`<ellipse cx="${cx}" cy="${cy}" rx="303" ry="389" fill="#decbb9" stroke="#b69a85" stroke-width="2"/>`);
for (let i = 0; i < 28; i++) {
  const a = i / 28 * Math.PI * 2;
  elements.push(use('spray', cx + Math.cos(a) * 275, cy + Math.sin(a) * 353, .62, i / 28 * 360 + 90));
}
elements.push(`<ellipse cx="${cx}" cy="${cy}" rx="208" ry="270" fill="#c6a09a" stroke="#b69483" stroke-width="3"/>`);
for (let i = 0; i < 16; i++) {
  const a = i / 16 * Math.PI * 2;
  elements.push(use('acanthus', cx + Math.cos(a) * 179, cy + Math.sin(a) * 230, 1.0, i / 16 * 360 + 90));
  elements.push(use('rose', cx + Math.cos(a) * 118, cy + Math.sin(a) * 156, .66));
}
elements.push(use('bouquet', cx, cy, 1.9));
elements.push('</svg>');
const svg = elements.join('');
await writeFile(new URL('rose-carpet.svg', out), svg);

// Uneven vegetable dye and dense warp/weft break the perfect vector edges.
const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const height = Buffer.alloc(W * H);
let seed = 1886;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x, i = p * 4;
  const weave = (x % 3 === 0 ? -5 : 1.2) + (y % 3 === 0 ? -3.2 : 1);
  const noise = (random() - .5) * 15;
  const abrash = Math.sin(y * .053) * 2 + Math.sin(y * .014 + Math.sin(x * .004)) * 2.5;
  const wear = .10 + .09 * Math.pow(Math.sin(x * .007) * Math.sin(y * .006), 2);
  for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, data[i + c] * (1 - wear) + [204, 183, 163][c] * wear + weave + noise + abrash));
  height[p] = Math.max(0, Math.min(255, 140 + weave * 7 + noise * 2));
}
await sharp(data, { raw: info }).webp({ quality: 92 }).toFile(new URL('../materials/rose-carpet-color.webp', out).pathname);
await sharp(height, { raw: { width: W, height: H, channels: 1 } }).resize(1200, 870).webp({ quality: 87 }).toFile(new URL('../materials/rose-carpet-height.webp', out).pathname);
await sharp(data, { raw: info }).resize(1200, 870).webp({ quality: 87 }).toFile(new URL('../materials/rose-carpet-fallback.webp', out).pathname);
console.log('Built gilt lettering and the faded blush Aubusson carpet.');
