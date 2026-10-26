// Local, deterministic vector design and rasterization. No image services.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import './make-lettering.mjs';

const out = new URL('../public/ornaments/', import.meta.url);
await mkdir(out, { recursive: true });

const W = 2400, H = 1740;
const use = (id, x, y, scale = 1, angle = 0) => `<use href="#${id}" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"/>`;
const elements = [];
// Original drawing informed by the floral cartouche, corner sprays and bordered
// bouquets of Aberdeen's c.1850 Aubusson (ABDMS001663), not a facsimile:
// https://emuseum.aberdeencity.gov.uk/objects/12318/aubusson-carpet
// The Met's 1814–30 Aubusson (10.152.14) also supplies period context:
// https://www.metmuseum.org/art/collection/search/218949
const petals = [];
for (const [radius, count, offset, fill] of [[26, 7, 0, '#ddc5af'], [18, 6, 23, '#d5b2a2'], [11, 5, 8, '#c39b8d'], [5, 4, 45, '#b58a7c']]) {
  for (let i = 0; i < count; i++) {
    const r = radius * (1 + .055 * Math.sin(i * 7));
    petals.push(`<g transform="rotate(${offset + i * 360 / count})"><path d="M0 ${-r * .22}C${-r * .78} ${-r * .3} ${-r * .72} ${-r * 1.18} 0 ${-r}C${r * .74} ${-r * 1.17} ${r * .70} ${-r * .31} 0 ${-r * .22}Z" fill="${fill}" stroke="#aa8176" stroke-width=".65"/><path d="M${-r * .42} ${-r * .76}Q0 ${-r * 1.03} ${r * .43} ${-r * .75}" fill="none" stroke="#e6ceba" stroke-width=".85"/></g>`);
  }
}
const defs = `<defs>
  <g id="leaf" fill="#9c9c83" stroke="#7e8271" stroke-width="1.1">
    <path d="M0 0C-5-13-22-12-25-24C-16-23-20-36-24-42C-7-37 4-20 0 0Z"/>
    <path d="M0 0Q-3-22-24-42M-4-16-16-22M-8-25-16-33" fill="none" stroke="#c7c2a4"/>
  </g>
  <g id="acanthus" fill="#d9cbb0" stroke="#aa9180" stroke-width="1.3">
    <path d="M0 0C-18-3-41-26-28-42C-22-34-18-28-14-26C-30-45-17-57-12-64C-8-49-7-35-3-30C-9-53 4-65 10-64C11-40 2-15 0 0Z"/>
    <path d="M0-4Q-4-31 10-64M-4-18Q-19-26-28-42M-4-27Q-13-42-12-64" fill="none" stroke="#b19b83"/>
  </g>
  <g id="rose">${petals.join('')}</g>
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
  <g id="ribbon" fill="#d5b2a2" stroke="#ac887a" stroke-width="1.2">
    <path d="M0 0C-52-41-64-7-12 6C-36 18-18 37-37 56L-18 49-7 58C6 34-10 18 0 0Z"/>
    <path d="M0 0C52-41 64-7 12 6C36 18 18 37 37 56L18 49 7 58C-6 34 10 18 0 0Z"/>
    <path d="M-6-5Q0-9 6-5L7 8Q0 12-7 8Z" fill="#dfc6ae"/>
    <path d="M-8 0Q-33-18-40-12M8 0Q33-18 40-12M-2 15Q-2 35-24 49M2 15Q2 35 24 49" fill="none" stroke="#e1c9b1"/>
  </g>
  <pattern id="guard" width="42" height="42" patternUnits="userSpaceOnUse">
    <rect width="42" height="42" fill="#b68f83"/>
    <path d="M-21 0L21 42 63 0M-21 42L21 0 63 42" fill="none" stroke="#d5c5a8" stroke-width="1.8"/>
    <circle cx="21" cy="21" r="2.4" fill="#ddcbb0"/>
  </pattern>
</defs>`;
elements.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs}`);
elements.push(`<rect width="${W}" height="${H}" fill="#a48374"/>`);
function border(inset, fill, stroke = '#ab8e78', sw = 3) {
  elements.push(`<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
}
border(8, '#d7c4a6'); border(18, 'url(#guard)'); border(43, '#d9c9ae'); border(52, '#c3ad91'); border(65, '#e0cfb5');
// One continuous floral vocabulary turns around all four sides. The corner
// bouquets resolve the border instead of cutting a repeating tile at the seam.
function swag(x, y, span, angle, scale = 1) {
  const parts = [`<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">`, `<path d="M0 0C${span * .2} 48 ${span * .8} 48 ${span} 0" fill="none" stroke="#8e937b" stroke-width="3"/>`];
  for (let i = 1; i < 12; i++) {
    const t = i / 12, px = span * t, py = 144 * t * (1 - t), a = Math.atan2(144 * (1 - 2 * t), span) * 180 / Math.PI;
    parts.push(use('leaf', px, py, .62, a - 48), use('leaf', px, py, .52, a + 124));
    if (i % 3 === 0) parts.push(use('rose', px, py, .62, i * 23));
  }
  parts.push('</g>');
  elements.push(parts.join(''));
}
for (const [x, y, angle, length, count] of [[220, 139, 0, W - 440, 7], [W - 139, 220, 90, H - 440, 5], [W - 220, H - 139, 180, W - 440, 7], [139, H - 220, -90, H - 440, 5]]) {
  elements.push(`<g transform="translate(${x} ${y}) rotate(${angle})">`);
  for (let i = 0; i < count; i++) {
    const step = length / count;
    swag(i * step, 0, step, 0);
    elements.push(use('bouquet', (i + .5) * step, -8, .65), use('ribbon', i * step, 0, .46));
  }
  elements.push(use('ribbon', length, 0, .46), '</g>');
}
for (const [x, y, a] of [[145, 145, -45], [W - 145, 145, 45], [W - 145, H - 145, 135], [145, H - 145, 225]]) elements.push(use('bouquet', x, y, 1.3, a));
border(228, 'url(#guard)'); border(250, '#d9c5a8'); border(260, '#cfa8a4', '#a98c7e', 3);
// A shaped ivory frame encloses the rose field, with open space around floral
// festoons. This replaces the previous all-over ogee wallpaper repeat.
const cartouche = `M550 288H1850C1870 360 1950 385 2060 373C2025 485 2085 510 2112 545V1195C2040 1220 2025 1300 2060 1367C1950 1355 1870 1380 1850 1452H550C530 1380 450 1355 340 1367C375 1255 315 1230 288 1195V545C360 520 375 440 340 373C450 385 530 360 550 288Z`;
elements.push(`<path d="${cartouche}" fill="none" stroke="#aa8b7c" stroke-width="26"/><path d="${cartouche}" fill="none" stroke="#ddcbb0" stroke-width="20"/><path d="${cartouche}" fill="none" stroke="#bd9d87" stroke-width="2"/>`);
for (const [x, y, a] of [[280, 280, 0], [W - 280, 280, 90], [W - 280, H - 280, 180], [280, H - 280, 270]]) {
  elements.push(`<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0H240C220 65 125 42 120 126C42 135 65 220 0 240Z" fill="#ddcdb3" stroke="#ad9180" stroke-width="3"/>${use('bouquet', 72, 73, 1.4, -45)}${use('acanthus', 24, 198, 1.15, 20)}${use('acanthus', 198, 24, 1.15, 70)}</g>`);
}
// Floral swags hang from ribbon ties just inside the shaped border.
for (const [x, y, a] of [[570, 340, 0], [W - 570, H - 340, 180]]) {
  elements.push(`<g transform="translate(${x} ${y}) rotate(${a})">`);
  for (let i = 0; i < 4; i++) {
    swag(i * 315, 0, 315, 0);
    elements.push(use('ribbon', i * 315, 0, .65), use('bouquet', i * 315 + 158, 73, .8));
  }
  elements.push(use('ribbon', 1260, 0, .65), '</g>');
}
for (const [x, y, a] of [[352, 563, -90], [W - 352, H - 563, 90]]) {
  elements.push(`<g transform="translate(${x} ${y}) rotate(${a})">`);
  for (let i = 0; i < 2; i++) { swag(-i * 306, 0, -306, 0); elements.push(use('bouquet', -i * 306 - 153, 63, 1), use('ribbon', -i * 306, 0, .65)); }
  elements.push('</g>');
}
// A central bouquet medallion remains part of the complete textile even where
// the desk conceals it. Broad botanical scrolls connect it to the corner sprays.
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
elements.push(use('bouquet', cx, cy, 2.5));
for (const side of [-1, 1]) {
  elements.push(`<g transform="translate(${cx + side * 430} ${cy}) scale(${side} 1)"><path d="M0 0C160-190 310-120 280 5C270 100 100 95 145 15C175-30 228-14 206 24M0 0C160 190 310 120 280-5" fill="none" stroke="#d8c4a9" stroke-width="9"/>${use('acanthus', 42, -38, 1.8, 65)}${use('acanthus', 42, 38, 1.8, 115)}${use('bouquet', 290, -12, 1.5, 90)}${use('spray', 180, -110, 1.1, 65)}${use('spray', 180, 110, 1.1, 115)}</g>`);
}
elements.push('</svg>');
const svg = elements.join('');
await writeFile(new URL('rose-carpet.svg', out), svg);

// Fine weft-faced tapestry ribbing and restrained dye variation; no pile sheen
// or directional lighting is baked into the textile's colour map.
const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const height = Buffer.alloc(W * H);
let seed = 1886;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x, i = p * 4;
  const weave = (x % 3 === 0 ? -3.8 : 1.1) + ((y + Math.floor(x / 3) % 2) % 4 === 0 ? -1.9 : .5);
  const noise = (random() - .5) * 10;
  const abrash = Math.sin(y * .053) * 1.1 + Math.sin(y * .014 + Math.sin(x * .004)) * 1.8;
  const wear = .10 + .06 * Math.pow(Math.sin(x * .007) * Math.sin(y * .006), 2);
  for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, data[i + c] * (1 - wear) + [204, 183, 163][c] * wear + weave + noise + abrash));
  height[p] = Math.max(0, Math.min(255, 140 + weave * 7 + noise * 2));
}
await sharp(data, { raw: info }).webp({ quality: 92 }).toFile(new URL('../materials/rose-carpet-color.webp', out).pathname);
await sharp(height, { raw: { width: W, height: H, channels: 1 } }).resize(1200, 870).webp({ quality: 87 }).toFile(new URL('../materials/rose-carpet-height.webp', out).pathname);
await sharp(data, { raw: info }).resize(1200, 870).webp({ quality: 87 }).toFile(new URL('../materials/rose-carpet-fallback.webp', out).pathname);
console.log('Built gilt lettering and the faded blush Aubusson carpet.');
