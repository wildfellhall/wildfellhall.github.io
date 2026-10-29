import * as THREE from 'three';
import regularUrl from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2?url';
import boldUrl from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff2?url';
import italicUrl from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff2?url';
import mastheadUrl from '@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2?url';
import { createPaperStock, canvasFromMap, paperNoise } from './paper-stock.js';
import { dateLabel, paginateGazette } from './gazette-text.js';

const W = 1400, H = 1900, FACE = '"Gazette Baskerville", serif';
export async function loadGazetteFonts() {
  await Promise.all([[regularUrl, '400', 'normal'], [boldUrl, '700', 'normal'], [italicUrl, '400', 'italic']].map(async ([url, weight, style]) => {
    const face = await new FontFace('Gazette Baskerville', `url("${url}")`, { weight, style }).load(); document.fonts.add(face);
  }));
  const masthead = await new FontFace('Gazette Fraktur', `url("${mastheadUrl}")`).load(); document.fonts.add(masthead);
}
function canvas(width = W, height = H) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; return c;
}
function ornament(ctx, x, y, width) {
  ctx.save(); ctx.translate(x, y); ctx.scale(width / 200, width / 200); ctx.lineWidth = 1;
  for (const sign of [-1, 1]) {
    ctx.save(); ctx.scale(sign, 1);
    ctx.stroke(new Path2D('M0 0C25-22 49 21 75 0C91-14 75-26 65-17C58-10 64-4 69-7M10 2C30 22 70 24 98 2M23 1Q36-18 48-15M42 12Q51-3 64 1'));
    for (const [x1, y1, a] of [[29, 9, -.6], [47, 16, -.1], [60, 13, .8], [41, -8, 1]]) {
      ctx.save(); ctx.translate(x1, y1); ctx.rotate(a); ctx.stroke(new Path2D('M0 0Q-13-8-5-18Q6-11 0 0M0 0-5-18')); ctx.restore();
    }
    ctx.restore();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

// Original pen-and-hatch vignette, informed by the engraved skyline on the
// Illustrated London News (14 May 1842). No generated or copied raster art.
function engraving(ctx) {
  ctx.save(); ctx.translate(700, 354); ctx.scale(1.35, 1.05); ctx.lineWidth = 1.25;
  const path = d => ctx.stroke(new Path2D(d));
  for (let i = 0; i < 52; i++) {
    const y = -20 + i * 1.8, extent = Math.sin(i / 52 * Math.PI) * 267;
    ctx.globalAlpha = .20; path(`M${-extent} ${y}Q0 ${y - 12} ${extent} ${y - 3}`);
  }
  ctx.globalAlpha = 1; ctx.fillStyle = '#eae4d6';
  const house = new Path2D('M-158 42V-58L-116-96-75-58V-70L-26-115 24-70V-58L76-95 116-58V42Z');
  ctx.fill(house); ctx.stroke(house);
  path('M-168-55-116-104-65-55M-82-67-26-123 32-67M15-55 76-103 126-55M-146 37H111M-67-57V37M16-57V37M-158-48H116M-153-45H113M-64-65H14');
  path('M-129-90V-122H-114V-97M-132-123H-111M53-90V-121H68V-103M50-122H71');
  // Closely spaced incised hatching gives the gables, masonry and window
  // recesses the weight of a wood engraving, rather than an outline icon.
  for (const [left, apex, right] of [[-158, -116, -75], [-75, -26, 24], [24, 76, 116]]) {
    const top = apex === -26 ? -115 : -96, bottom = apex === -26 ? -70 : -58;
    for (let y = top + 3; y < bottom; y += 2.8) {
      const f = (y - top) / (bottom - top); path(`M${apex + (left - apex) * f} ${y}H${apex + (right - apex) * f}`);
    }
  }
  for (let x = -157; x < 116; x += 3.2) {
    if ((x > -64 && x < -57) || (x > 12 && x < 23) || x < -146 || x > 107) path(`M${x} -42V37`);
  }
  for (const x of [-139, -103, -54, -14, 42, 80]) for (const y of [-38, 2]) {
    path(`M${x} ${y + 23}V${y}h17v23ZM${x + 8} ${y}v23M${x} ${y + 10}h17`);
    for (let j = 2; j < 16; j += 2.5) path(`M${x + j} ${y + 1}v8M${x + j} ${y + 12}v9`);
  }
  path('M-42 42V6Q-27-11-11 6V42M-45 42H-7M-49 46H-3M-55 50H3M-28 1V41');
  for (let i = 0; i < 21; i++) {
    const y = -44 + i * 4; path(`M-155 ${y}h14M-120 ${y}h15M-84 ${y}h15M19 ${y}h21M60 ${y}h18M99 ${y}h15`);
  }
  for (let i = 0; i < 120; i++) {
    const x = (paperNoise(i, 1) - .5) * 500, y = 48 + paperNoise(i, 2) * 27;
    path(`M${x} ${y}l${5 + paperNoise(i, 3) * 13} -2`);
  }
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1);
    path('M185 48Q173-5 180-63M180-10 155-34M179-36 204-61M181-50 164-75');
    for (let i = 0; i < 125; i++) {
      const a = paperNoise(i, 4) * Math.PI * 2, r = Math.sqrt(paperNoise(i, 5)) * 50;
      const x = 181 + Math.cos(a) * r, y = -62 + Math.sin(a) * r * .85;
      path(`M${x} ${y}q-7-6-11 1q5 4 10 0M${x - 3} ${y + 2}l5 3`);
    }
    ctx.restore();
  }
  ctx.restore();
}

export function createGazettePrinting(issue, maxTextureSize) {
  const stock = createPaperStock(41, true), background = canvasFromMap(stock.map), height = canvasFromMap(stock.bumpMap);
  const measure = canvas().getContext('2d'); measure.font = `24px ${FACE}`;
  const titleMeasure = canvas().getContext('2d'); titleMeasure.font = `700 30px ${FACE}`;
  const pages = paginateGazette(issue, s => measure.measureText(s).width, s => titleMeasure.measureText(s).width);
  const scale = Math.min(2, maxTextureSize / H), cache = new Map();
  function get(page = 0, reverse = false) {
    const key = `${page}:${reverse}`; if (cache.has(key)) return cache.get(key);
    const ink = canvas(Math.round(W * scale), Math.round(H * scale)), ctx = ink.getContext('2d', { willReadFrequently: true });
    ctx.scale(scale, scale); ctx.fillStyle = ctx.strokeStyle = '#151612'; ctx.lineWidth = 1;
    if (reverse) { ctx.translate(0, H); ctx.scale(1, -1); }
    ctx.textAlign = 'center';
    ctx.font = '32px "Gazette Fraktur"'; ctx.fillText('The', W / 2, 100);
    ctx.font = '112px "Gazette Fraktur"'; ctx.fillText('Wildfell Gazette', W / 2, 207);
    ornament(ctx, 177, 110, 116); ornament(ctx, W - 177, 110, 116);
    ctx.beginPath(); ctx.moveTo(80, 228); ctx.lineTo(1320, 228); ctx.stroke();
    engraving(ctx);
    ctx.lineWidth = 2; ctx.strokeRect(80, 452, 1240, 53);
    // Cover the short box ends: newspaper rules are horizontal printer's rules.
    ctx.clearRect(78, 454, 4, 49); ctx.clearRect(1318, 454, 4, 49);
    ctx.font = `700 19px ${FACE}`; ctx.fillText(dateLabel(issue.date).toUpperCase(), W / 2, 486);
    ctx.font = `18px ${FACE}`; ctx.textAlign = 'left';
    if (issue.number) ctx.fillText(`No. ${issue.number}`, 90, 486);
    ctx.textAlign = 'right'; ctx.fillText(`${page + 1}`, 1308, 486);
    const sections = pages[page].sections;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i], x = 90 + i % 3 * 420, top = i < 3 ? 552 : 1290;
      if (i % 3) { ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x - 25, top - 16); ctx.lineTo(x - 25, i < 3 ? 1228 : 1775); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.font = `700 30px ${FACE}`;
      let y = top;
      for (const title of s.titles) { ctx.fillText(title, x + 185, y, 370); y += 42; }
      if (s.continued) { ctx.font = `italic 18px ${FACE}`; ctx.fillText('(continued)', x + 185, y); y += 27; }
      ctx.font = `italic 20px ${FACE}`;
      for (const byline of s.bylines) { ctx.fillText(byline, x + 185, y); y += 30; }
      ornament(ctx, x + 185, y + 8, 94); y += 48;
      ctx.font = `24px ${FACE}`; ctx.textAlign = 'left';
      ctx.lineWidth = .22;
      for (const line of s.lines) { ctx.fillText(line, x, y); ctx.strokeText(line, x, y); y += 30; }
    }
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(80, 1250); ctx.lineTo(1320, 1250); ctx.stroke();
    ornament(ctx, W / 2, 1831, 195);
    // Letterpress contact: fine fibre interruptions, inky shoulders, and a
    // shallow matching indentation, all on the lit paper material itself.
    const pixels = ctx.getImageData(0, 0, ink.width, ink.height), data = pixels.data;
    for (let y = 0; y < ink.height; y++) for (let x = 0; x < ink.width; x++) {
      const i = (y * ink.width + x) * 4; if (!data[i + 3]) continue;
      const n = paperNoise(x, y, 7), patch = paperNoise(Math.floor(x / 3), Math.floor(y / 3), 11);
      data[i + 3] *= patch < .025 ? .55 + n * .30 : .91 + n * .09;
    }
    ctx.putImageData(pixels, 0, 0);
    const print = canvas(ink.width, ink.height), paint = print.getContext('2d');
    paint.drawImage(background, 0, 0, print.width, print.height);
    paint.save(); paint.globalAlpha = .16; paint.filter = 'blur(.55px)'; paint.drawImage(ink, 0, 0); paint.restore();
    paint.drawImage(ink, 0, 0);
    const relief = canvas(1024, Math.round(1024 * H / W)), rctx = relief.getContext('2d', { willReadFrequently: true });
    rctx.drawImage(height, 0, 0, relief.width, relief.height);
    const values = rctx.getImageData(0, 0, relief.width, relief.height);
    rctx.clearRect(0, 0, relief.width, relief.height); rctx.drawImage(ink, 0, 0, relief.width, relief.height);
    const coverage = rctx.getImageData(0, 0, relief.width, relief.height).data;
    for (let i = 0; i < values.data.length; i += 4) for (let c = 0; c < 3; c++) values.data[i + c] -= coverage[i + 3] / 255 * 9;
    rctx.putImageData(values, 0, 0);
    const material = stock.clone(); material.map = new THREE.CanvasTexture(print); material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.anisotropy = 8; material.normalMap = null; material.bumpMap = new THREE.CanvasTexture(relief);
    material.bumpScale = .003; material.name = `gazette-${issue.date}-${page + 1}${reverse ? '-reverse' : ''}`;
    cache.set(key, material);
    // At most the current and previous sheet's two faces stay on the GPU.
    for (const [oldKey, old] of cache) {
      if (cache.size <= 4) break;
      if (oldKey.startsWith(`${page}:`)) continue;
      old.map.dispose(); old.bumpMap.dispose(); old.dispose(); cache.delete(oldKey);
    }
    return material;
  }
  return { pages, get, dispose() {
    for (const material of cache.values()) { material.map.dispose(); material.bumpMap.dispose(); material.dispose(); }
    for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap']) stock[key]?.dispose(); stock.dispose();
  } };
}
