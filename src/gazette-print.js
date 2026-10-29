import * as THREE from 'three';
import regularUrl from './assets/fonts/imfelldwpica.woff2?url';
import italicUrl from './assets/fonts/imfelldwpica-italic.woff2?url';
import headingUrl from './assets/fonts/imfellgreatprimer.woff2?url';
import noticeUrl from './assets/fonts/besley.woff2?url';
import { createPaperStock, canvasFromMap, paperNoise } from './paper-stock.js';
import { distressPressInk } from './press-ink.js';
import { dateLabel, paginateGazette, GAZETTE_TYPE } from './gazette-text.js';
import { composeGazetteText } from './gazette-composition.js';

const W = 1400, H = 1900, FACE = '"Gazette Pica", serif', HEADING = '"Gazette Primer", serif';
let masthead;
export async function loadGazetteFonts() {
  await Promise.all([
    ...[[regularUrl, 'Gazette Pica', 'normal'], [italicUrl, 'Gazette Pica', 'italic'],
      [headingUrl, 'Gazette Primer', 'normal'], [noticeUrl, 'Gazette Notices', 'normal']].map(async ([url, family, style]) => {
      const face = await new FontFace(family, `url("${url}")`, { style }).load(); document.fonts.add(face);
    }),
    new Promise((resolve, reject) => {
      masthead = new Image(); masthead.onload = resolve; masthead.onerror = reject;
      masthead.src = `${import.meta.env.BASE_URL}ornaments/gazette-masthead.svg`;
    }),
  ]);
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
  ctx.save(); ctx.translate(700, compact ? 291 : 354); ctx.scale(compact ? .69 : 1.35, compact ? .48 : 1.05); ctx.lineWidth = 1.25;
  const path = d => ctx.stroke(new Path2D(d));
  for (let i = 0; i < 52; i++) {
    const y = -20 + i * 1.8, extent = Math.sin(i / 52 * Math.PI) * 267;
    ctx.globalAlpha = .20; path(`M${-extent} ${y}Q0 ${y - 12} ${extent} ${y - 3}`);
  }
  ctx.globalAlpha = 1;
  const house = new Path2D('M-158 42V-58L-116-96-75-58V-70L-26-115 24-70V-58L76-95 116-58V42Z');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fill(house);
  ctx.globalCompositeOperation = 'source-over'; ctx.stroke(house);
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
function pageDesign(ctx, page, issue, count) {
  ctx.fillStyle = ctx.strokeStyle = '#090909'; ctx.textAlign = 'center';
  if (page.front) {
    ctx.font = `23px ${HEADING}`; ctx.fillText('THE', W / 2, 70);
    ctx.drawImage(masthead, 102, 78, 1196, 182);
    rule(ctx, 253, 78, 1244, true); engraving(ctx, true);
    ctx.font = `20px "Gazette Notices", serif`;
    ctx.fillText('ARTICLES & CORRESPONDENCE', 290, 290);
    ctx.fillText('LITERATURE & MISCELLANY', 1110, 290);
    ornament(ctx, 290, 319, 110); ornament(ctx, 1110, 319, 110);
    rule(ctx, 344, 78, 1244, true);
    ctx.font = `24px ${HEADING}`; ctx.fillText(dateLabel(issue.date).toUpperCase(), W / 2, 380);
    ctx.textAlign = 'left'; ctx.font = `23px ${FACE}`; if (issue.number) ctx.fillText(`No. ${issue.number}.`, 84, 380);
    ctx.textAlign = 'right'; ctx.fillText(`${count} PAGES.`, 1316, 380); rule(ctx, 397);
    ctx.textAlign = 'center'; ctx.font = `20px ${HEADING}`; ctx.fillText('CONTENTS OF THIS NUMBER.', W / 2, 429);
    ctx.font = `22px ${FACE}`;
    for (const [i, item] of page.contents.entries()) {
      const x = 92 + i % 3 * 424, y = 464 + Math.floor(i / 3) * 30;
      let label = item.label;
      while (ctx.measureText(label).width > 300) label = label.slice(0, -2).trimEnd() + '…';
      ctx.textAlign = 'left'; ctx.fillText(label, x, y);
      const left = x + ctx.measureText(label).width + 10, end = x + 354;
      ctx.save(); ctx.setLineDash([1, 6]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y - 3); ctx.lineTo(end, y - 3); ctx.stroke(); ctx.restore();
      ctx.textAlign = 'right'; ctx.fillText(String(item.page), x + 376, y);
    }
    rule(ctx, 515, 78, 1244, true);
  } else {
    ctx.font = `27px ${HEADING}`; ctx.fillText('THE WILDFELL GAZETTE.', W / 2, 94);
    ctx.textAlign = 'left'; ctx.font = `24px ${FACE}`; ctx.fillText(String(page.number), 80, 94);
    ctx.textAlign = 'right'; ctx.fillText(dateLabel(issue.date).toUpperCase(), 1320, 94); rule(ctx, 116, 78, 1244, true);
    ctx.textAlign = 'center'; ctx.font = `26px ${HEADING}`; ctx.fillText(page.name.toUpperCase(), W / 2, 164);
    rule(ctx, 181);
  }
  for (const [i, story] of page.sections.entries()) {
    const { x, width, top, bodyY, columnWidth } = story;
    if (i) {
      for (const offset of [-26, -22]) { ctx.lineWidth = offset === -26 ? 1.4 : .6; ctx.beginPath(); ctx.moveTo(x + offset, top - 16); ctx.lineTo(x + offset, 1750); ctx.stroke(); }
    }
    ctx.textAlign = 'center'; ctx.font = `20px ${HEADING}`;
    if (story.title) ctx.fillText(story.label.toUpperCase(), x + width / 2, top + 5);
    ctx.font = `${story.headline}px ${HEADING}`; let y = top + 38;
    for (const title of story.titles) { ctx.fillText(title.toUpperCase(), x + width / 2, y); y += story.headline + 5; }
    ctx.font = `italic 25px ${FACE}`;
    for (const subtitle of story.subtitles) { ctx.fillText(subtitle, x + width / 2, y); y += 30; }
    ctx.font = `italic 24px ${FACE}`;
    for (const byline of story.bylines) { ctx.fillText(byline, x + width / 2, y); y += 27; }
    if (story.continued) { ctx.font = `italic 22px ${FACE}`; ctx.fillText(`Continued from page ${story.previousPage}.`, x + width / 2, y); }
    rule(ctx, bodyY - 23, x + width * .34, width * .32);
    ctx.textAlign = 'left'; ctx.font = `${GAZETTE_TYPE.fontSize}px ${FACE}`;
    for (const [col, lines] of story.columns.entries()) {
      const cx = x + col * (columnWidth + 36);
      if (col) { ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(cx - 18, bodyY - 6); ctx.lineTo(cx - 18, 1732); ctx.stroke(); }
      for (const [lineIndex, line] of lines.entries()) {
        for (const run of line.runs) {
          // Metal type sits on a common baseline. Irregularity belongs to the
          // outline and the ink contact, not random rotations of every word.
          ctx.fillText(run.text, cx + run.x, bodyY + lineIndex * GAZETTE_TYPE.leading);
        }
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
  const titleMeasure = canvas().getContext('2d'); titleMeasure.font = `38px ${HEADING}`;
  const pages = paginateGazette(issue, s => measure.measureText(s).width, s => titleMeasure.measureText(s.toUpperCase()).width, composeGazetteText);
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
    for (let i = 0; i < values.data.length; i += 4) for (let c = 0; c < 3; c++) values.data[i + c] -= coverage[i + 3] / 255 * 3;
    rctx.putImageData(values, 0, 0);
    const roughness = canvas(relief.width, relief.height), roughCtx = roughness.getContext('2d');
    const roughPixels = roughCtx.createImageData(relief.width, relief.height);
    for (let i = 0; i < coverage.length; i += 4) {
      const value = 235 - coverage[i + 3] / 255 * 18;
      roughPixels.data.set([value, value, value, 255], i);
    }
    roughCtx.putImageData(roughPixels, 0, 0);
    const material = stock.clone(); material.map = new THREE.CanvasTexture(print); material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.anisotropy = 8; material.normalMap = null; material.bumpMap = new THREE.CanvasTexture(relief);
    material.roughnessMap = new THREE.CanvasTexture(roughness);
    material.bumpScale = .0014; material.sheen = 0; material.specularIntensity = .035;
    material.name = `gazette-${issue.date}-${page + 1}${reverse ? '-reverse' : ''}`;
    cache.set(key, material); return material;
  }
  const dispose = material => { material.map.dispose(); material.bumpMap.dispose(); material.roughnessMap.dispose(); material.dispose(); };
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
