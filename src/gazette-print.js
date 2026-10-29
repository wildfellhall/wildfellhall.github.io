import * as THREE from 'three';
import regularUrl from '@fontsource/old-standard-tt/files/old-standard-tt-latin-400-normal.woff2?url';
import boldUrl from '@fontsource/old-standard-tt/files/old-standard-tt-latin-700-normal.woff2?url';
import italicUrl from '@fontsource/old-standard-tt/files/old-standard-tt-latin-400-italic.woff2?url';
import mastheadUrl from '@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2?url';
import { createPaperStock, canvasFromMap, paperNoise } from './paper-stock.js';
import { distressPressInk } from './press-ink.js';
import { dateLabel, paginateGazette, GAZETTE_TYPE } from './gazette-text.js';

const W = 1400, H = 1900, FACE = '"Gazette Old Standard", serif';
export async function loadGazetteFonts() {
  await Promise.all([[regularUrl, '400', 'normal'], [boldUrl, '700', 'normal'], [italicUrl, '400', 'italic']].map(async ([url, weight, style]) => {
    const face = await new FontFace('Gazette Old Standard', `url("${url}")`, { weight, style }).load(); document.fonts.add(face);
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
function engraving(ctx, compact = false) {
  ctx.save(); ctx.translate(700, compact ? 355 : 354); ctx.scale(compact ? .90 : 1.35, compact ? .64 : 1.05); ctx.lineWidth = 1.25;
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

function rule(ctx, y, x = 78, width = 1244, heavy = false) {
  ctx.lineWidth = heavy ? 3.1 : 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width, y); ctx.stroke();
  if (heavy) { ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x + width, y + 5); ctx.stroke(); }
}
function printLine(ctx, text, x, y, width, justify, seed) {
  const words = text.split(' '), normalSpace = ctx.measureText(' ').width;
  const extra = justify && words.length > 1 ? (width - ctx.measureText(text).width) / (words.length - 1) : 0;
  const space = normalSpace + (extra < normalSpace * 2 ? extra : 0);
  let cursor = x;
  for (const [i, word] of words.entries()) {
    ctx.save(); ctx.translate(cursor, y + (paperNoise(i, Math.round(y), seed) - .5) * .65);
    ctx.rotate((paperNoise(i, 1, seed) - .5) * .0015);
    ctx.fillText(word, 0, 0); ctx.lineWidth = .32; ctx.strokeText(word, 0, 0); ctx.restore();
    cursor += ctx.measureText(word).width + space;
  }
}
function pageDesign(ctx, page, issue, count) {
  ctx.fillStyle = ctx.strokeStyle = '#10120f'; ctx.textAlign = 'center';
  if (page.front) {
    ctx.font = '32px "Gazette Fraktur"'; ctx.fillText('The', W / 2, 90);
    ctx.font = '132px "Gazette Fraktur"'; ctx.fillText('Wildfell Gazette', W / 2, 218);
    ornament(ctx, 164, 106, 108); ornament(ctx, W - 164, 106, 108);
    rule(ctx, 251, 78, 1244, true); engraving(ctx, true);
    ctx.font = `700 21px ${FACE}`;
    ctx.fillText('ARTICLES', 210, 322); ctx.fillText('LITERATURE', 1190, 322);
    ctx.font = `italic 22px ${FACE}`;
    ctx.fillText('Thought a Day', 210, 357); ctx.fillText('Words of the Week', 1190, 357);
    ornament(ctx, 210, 393, 125); ornament(ctx, 1190, 393, 125);
    rule(ctx, 428, 78, 1244, true);
    ctx.font = `700 23px ${FACE}`; ctx.fillText(dateLabel(issue.date).toUpperCase(), W / 2, 467);
    ctx.textAlign = 'left'; ctx.font = `22px ${FACE}`; if (issue.number) ctx.fillText(`No. ${issue.number}`, 84, 467);
    ctx.textAlign = 'right'; ctx.fillText(`${count} PAGES`, 1316, 467); rule(ctx, 485);
    ctx.textAlign = 'center'; ctx.font = `700 21px ${FACE}`; ctx.fillText('CONTENTS OF THIS NUMBER.', W / 2, 524);
    ctx.font = `21px ${FACE}`;
    for (const [i, item] of page.contents.entries()) {
      const x = 92 + i % 3 * 424, y = 560 + Math.floor(i / 3) * 33;
      let label = item.label;
      while (ctx.measureText(label).width > 300) label = label.slice(0, -2).trimEnd() + '…';
      ctx.textAlign = 'left'; ctx.fillText(label, x, y);
      const left = x + ctx.measureText(label).width + 10, end = x + 354;
      ctx.save(); ctx.setLineDash([1, 6]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(left, y - 3); ctx.lineTo(end, y - 3); ctx.stroke(); ctx.restore();
      ctx.textAlign = 'right'; ctx.fillText(String(item.page), x + 376, y);
    }
    rule(ctx, 619, 78, 1244, true);
    ctx.textAlign = 'center'; ctx.font = `700 22px ${FACE}`; ctx.fillText('ARTICLES & CORRESPONDENCE.', W / 2, 670); rule(ctx, 689);
  } else {
    ctx.font = `700 27px ${FACE}`; ctx.fillText('THE WILDFELL GAZETTE.', W / 2, 94);
    ctx.textAlign = 'left'; ctx.font = `24px ${FACE}`; ctx.fillText(String(page.number), 80, 94);
    ctx.textAlign = 'right'; ctx.fillText(dateLabel(issue.date).toUpperCase(), 1320, 94); rule(ctx, 116, 78, 1244, true);
    ctx.textAlign = 'center'; ctx.font = `700 51px ${FACE}`; ctx.fillText(page.name.toUpperCase(), W / 2, 212);
    ornament(ctx, W / 2, 256, 170); rule(ctx, 284);
  }
  for (const [i, story] of page.sections.entries()) {
    const { x, width, top, bodyY, columnWidth } = story;
    if (i) {
      for (const offset of [-26, -22]) { ctx.lineWidth = offset === -26 ? 1.4 : .6; ctx.beginPath(); ctx.moveTo(x + offset, top - 16); ctx.lineTo(x + offset, 1750); ctx.stroke(); }
    }
    ctx.textAlign = 'center'; ctx.font = `700 20px ${FACE}`;
    if (story.title) ctx.fillText(story.label.toUpperCase(), x + width / 2, top + 5);
    ctx.font = `700 ${story.headline}px ${FACE}`; let y = top + 60;
    for (const title of story.titles) { ctx.fillText(title.toUpperCase(), x + width / 2, y); y += story.headline + 8; }
    ctx.font = `italic 27px ${FACE}`;
    for (const subtitle of story.subtitles) { ctx.fillText(subtitle, x + width / 2, y); y += 33; }
    ctx.font = `italic 24px ${FACE}`;
    for (const byline of story.bylines) { ctx.fillText(byline, x + width / 2, y); y += 29; }
    if (story.continued) { ctx.font = `italic 22px ${FACE}`; ctx.fillText(`Continued from page ${story.previousPage}.`, x + width / 2, y); }
    rule(ctx, bodyY - 34, x + width * .34, width * .32);
    ctx.textAlign = 'left'; ctx.font = `${GAZETTE_TYPE.fontSize}px ${FACE}`;
    for (const [col, lines] of story.columns.entries()) {
      const cx = x + col * (columnWidth + 36);
      if (col) { ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(cx - 18, bodyY - 6); ctx.lineTo(cx - 18, 1732); ctx.stroke(); }
      for (const [lineIndex, line] of lines.entries()) {
        const end = lineIndex === lines.length - 1;
        const justify = Boolean(line && (end ? story.continues || col < story.columns.length - 1 && story.columns[col + 1].length : lines[lineIndex + 1]));
        printLine(ctx, line, cx, bodyY + lineIndex * GAZETTE_TYPE.leading, columnWidth, justify, page.number * 73 + col);
      }
    }
    // Short printer's ornaments close an item; the footer gives a real page
    // destination when the composited article needs another sheet.
    ctx.textAlign = 'center'; ctx.font = `italic 22px ${FACE}`;
    if (story.continues) ctx.fillText(`Continued on page ${story.nextPage}.`, x + width / 2, 1760);
    else { rule(ctx, 1758, x + width * .39, width * .22); ornament(ctx, x + width / 2, 1778, 66); }
  }
  rule(ctx, 1810, 78, 1244, true);
  ctx.textAlign = 'center'; ctx.font = `22px ${FACE}`; ctx.fillText(`— ${page.number} —`, W / 2, 1853);
}

export function createGazettePrinting(issue, maxTextureSize = 4096) {
  const stock = createPaperStock(41, true), background = canvasFromMap(stock.map), height = canvasFromMap(stock.bumpMap);
  const measure = canvas().getContext('2d'); measure.font = `${GAZETTE_TYPE.fontSize}px ${FACE}`;
  const titleMeasure = canvas().getContext('2d'); titleMeasure.font = `700 38px ${FACE}`;
  const pages = paginateGazette(issue, s => measure.measureText(s).width, s => titleMeasure.measureText(s.toUpperCase()).width);
  const cache = new Map();
  function get(page = 0, reverse = false, low = false) {
    const key = `${page}:${reverse}:${low}`; if (cache.has(key)) return cache.get(key);
    const scale = Math.min(low ? .55 : 2, maxTextureSize / H);
    const ink = canvas(Math.round(W * scale), Math.round(H * scale)), ctx = ink.getContext('2d', { willReadFrequently: true });
    ctx.scale(scale, scale); if (reverse) { ctx.translate(0, H); ctx.scale(1, -1); }
    pageDesign(ctx, pages[page], issue, pages.length);
    const impression = distressPressInk(ink, 1871 + page, scale, stock.bumpMap.image);
    const print = canvas(ink.width, ink.height), paint = print.getContext('2d');
    paint.drawImage(background, 0, 0, print.width, print.height);
    paint.drawImage(impression, 0, 0);
    const relief = canvas(low ? 512 : 1024, Math.round((low ? 512 : 1024) * H / W)), rctx = relief.getContext('2d', { willReadFrequently: true });
    rctx.drawImage(height, 0, 0, relief.width, relief.height);
    const values = rctx.getImageData(0, 0, relief.width, relief.height);
    rctx.clearRect(0, 0, relief.width, relief.height); rctx.drawImage(impression, 0, 0, relief.width, relief.height);
    const coverage = rctx.getImageData(0, 0, relief.width, relief.height).data;
    for (let i = 0; i < values.data.length; i += 4) for (let c = 0; c < 3; c++) values.data[i + c] -= coverage[i + 3] / 255 * 12;
    rctx.putImageData(values, 0, 0);
    const material = stock.clone(); material.map = new THREE.CanvasTexture(print); material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.anisotropy = 8; material.normalMap = null; material.bumpMap = new THREE.CanvasTexture(relief);
    material.bumpScale = .003; material.sheen = .025; material.specularIntensity = .09;
    material.name = `gazette-${issue.date}-${page + 1}${reverse ? '-reverse' : ''}`;
    cache.set(key, material); return material;
  }
  const dispose = material => { material.map.dispose(); material.bumpMap.dispose(); material.dispose(); };
  return { pages, get,
    prune(page) {
      for (const [key, material] of cache) if (!key.endsWith(':true') && key !== `${page}:false:false` && key !== '0:true:false') {
        dispose(material); cache.delete(key);
      }
    },
    dispose() {
      for (const material of cache.values()) dispose(material);
      for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap']) stock[key]?.dispose(); stock.dispose();
    },
  };
}
