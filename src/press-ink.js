import { paperNoise } from './paper-stock.js';

const canvasLike = source => {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; return canvas;
};

export function distressPressInk(canvas, seed, scale, paperHeight, finish = 'newspaper') {
  if (finish === 'book') return bookImpression(canvas, seed, scale, paperHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), p = pixels.data;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    if (!p[i + 3]) continue;
    const u = x / scale, v = y / scale;
    // Irregular inking is shared by small patches of a metal sort, rather
    // than lowering the opacity of the entire typeset line uniformly.
    const pressure = paperNoise(Math.floor(u / 9), Math.floor(v / 6), seed + 3);
    const tooth = paperNoise(Math.floor(u * 2), Math.floor(v * 2), seed + 9);
    const fibre = paperHeight.data[(Math.min(paperHeight.height - 1, Math.floor(y / canvas.height * paperHeight.height)) * paperHeight.width
      + Math.min(paperHeight.width - 1, Math.floor(x / canvas.width * paperHeight.width))) * 4];
    // Most of the impression is solid carbon black. Only high paper fibres
    // and occasional under-inked sorts interrupt the coverage; the cream
    // stock must not wash through every letter and turn the type brown.
    const missedFibre = fibre > 139 && tooth < .11 || tooth < .004;
    const contact = missedFibre ? .38 : 1;
    p[i + 3] *= (pressure < .08 ? .89 + pressure : .985) * contact;
  }
  ctx.putImageData(pixels, 0, 0);
  const result = canvasLike(canvas), paint = result.getContext('2d');
  paint.globalAlpha = .16; paint.filter = `blur(${.22 * scale}px)`;
  paint.drawImage(canvas, .08 * scale, .04 * scale);
  paint.filter = `blur(${.3 * scale}px)`; paint.globalAlpha = .13;
  for (let band = 0, y = 0; y < canvas.height; band++, y += 43 * scale) {
    if (paperNoise(band, 8, seed) > .09) continue;
    const x = paperNoise(band, 2, seed) * canvas.width;
    const w = Math.min(canvas.width - x, 45 * scale), h = Math.min(canvas.height - y, 4 * scale);
    paint.drawImage(canvas, x, y, w, h, x + .55 * scale, y, w, h);
  }
  paint.globalAlpha = 1; paint.filter = 'none'; paint.drawImage(canvas, 0, 0);
  return result;
}

const clamp = value => Math.max(0, Math.min(1, value));
function inkField(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = paperNoise(ix, iy, seed), b = paperNoise(ix + 1, iy, seed);
  const c = paperNoise(ix, iy + 1, seed), d = paperNoise(ix + 1, iy + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function bookImpression(canvas, seed, scale, paperHeight) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), ink = pixels.data;
  const original = ink.slice(), stride = canvas.width * 4;
  const alphaAt = (x, y) => {
    const left = Math.floor(x), top = Math.floor(y), dx = x - left, dy = y - top;
    if (left < 0 || top < 0 || left + 1 >= canvas.width || top + 1 >= canvas.height) return 0;
    const i = (top * canvas.width + left) * 4 + 3;
    return (original[i] * (1 - dx) + original[i + 4] * dx) * (1 - dy)
      + (original[i + stride] * (1 - dx) + original[i + stride + 4] * dx) * dy;
  };
  const heightAt = (x, y) => {
    const u = Math.max(0, Math.min(paperHeight.width - 1, x / canvas.width * paperHeight.width));
    const v = Math.max(0, Math.min(paperHeight.height - 1, y / canvas.height * paperHeight.height));
    const left = Math.floor(u), top = Math.floor(v), dx = u - left, dy = v - top;
    const right = Math.min(left + 1, paperHeight.width - 1), bottom = Math.min(top + 1, paperHeight.height - 1);
    const at = (xx, yy) => paperHeight.data[(yy * paperHeight.width + xx) * 4];
    return (at(left, top) * (1 - dx) + at(right, top) * dx) * (1 - dy)
      + (at(left, bottom) * (1 - dx) + at(right, bottom) * dx) * dy;
  };
  for (let y = 1; y < canvas.height - 1; y++) for (let x = 1; x < canvas.width - 1; x++) {
    const i = (y * canvas.width + x) * 4;
    if (!(original[i + 3] || original[i - 1] || original[i + 7]
      || original[i + 3 - stride] || original[i + 3 + stride])) continue;
    const u = x / scale, v = y / scale, fibre = heightAt(x, y);
    // Continuous fields avoid rectangular faded patches. Every impression
    // encounters different ink load, even when a letter is repeated.
    const load = inkField(u / 7.5, v / 5.2, seed + 3);
    const grain = inkField(u / 1.3, v / 1.9, seed + 9);
    const dry = clamp((.56 - load) * 2.1);
    const highFibre = clamp((fibre - 132) / 20);
    const dx = ((inkField(u / 2.4, v / 3.1, seed + 15) - .5) * .9 + (fibre - 128) * .009) * scale;
    const dy = (inkField(u / 3.7, v / 2.2, seed + 21) - .5) * .75 * scale;
    const centre = alphaAt(x + dx, y + dy);
    // Wet patches squeeze out slightly around strokes; drier patches keep
    // the worn outline. No baseline jitter, artificial shadow or full-line smear.
    const squeeze = clamp((load - .32) * 1.7);
    const rim = Math.max(alphaAt(x + dx + .42 * scale, y + dy),
      alphaAt(x + dx - .42 * scale, y + dy), alphaAt(x + dx, y + dy + .32 * scale));
    const coverage = Math.max(centre, rim * squeeze * .76);
    const pinhole = highFibre > .35 && grain < .31;
    const contact = (1 - highFibre * (.22 + dry * .42)) * (pinhole ? .48 : 1);
    ink[i + 3] = coverage * (1 - dry * .29) * contact;
    // Dense carbon ink with lighter granules inside the strokes, rather
    // than uniformly translucent brown lettering over cream paper.
    const carbon = 12 + dry * 19 + grain * 12 + highFibre * 9;
    ink[i] = carbon; ink[i + 1] = carbon; ink[i + 2] = carbon - 1;
  }
  ctx.putImageData(pixels, 0, 0);
  const result = canvasLike(canvas), paint = result.getContext('2d');
  // A narrow absorbed edge stays subordinate to the sharp impression.
  paint.globalAlpha = .18; paint.filter = `blur(${.34 * scale}px)`;
  paint.drawImage(canvas, .10 * scale, .06 * scale);
  paint.globalAlpha = 1; paint.filter = 'none'; paint.drawImage(canvas, 0, 0);
  return result;
}

export function spreadInk(source, seed, scale, amount = 1) {
  const result = canvasLike(source), ctx = result.getContext('2d');
  // Oil-based press ink wicks just beyond the dark impression. These widths
  // are in printed-page units, so the effect survives reduction to the view.
  ctx.globalAlpha = .29 * amount; ctx.filter = `blur(${.95 * scale}px)`;
  ctx.drawImage(source, .18 * scale, .10 * scale);
  ctx.filter = 'none'; ctx.globalAlpha = .12 * amount;
  for (const [x, y] of [[-.45, 0], [.50, .15], [0, .4]]) ctx.drawImage(source, x * scale, y * scale);
  // Short, local dragged impressions. No synthetic marks are added to empty
  // editorial space: every smear is drawn from actual type or printer's rules.
  ctx.filter = `blur(${.48 * scale}px)`;
  for (let band = 0, y = 0; y < source.height; band++, y += 19 * scale) {
    if (paperNoise(band, 0, seed) > .42) continue;
    const x = paperNoise(band, 1, seed) * source.width, w = Math.min(source.width - x, (90 + paperNoise(band, 2, seed) * 220) * scale);
    const h = Math.min(source.height - y, (3 + paperNoise(band, 3, seed) * 6) * scale);
    ctx.globalAlpha = (.14 + paperNoise(band, 4, seed) * .12) * amount;
    ctx.drawImage(source, x, y, w, h, x + (1 + paperNoise(band, 5, seed) * 1.7) * scale, y + .3 * scale, w, h);
  }
  ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.drawImage(source, 0, 0);
  return result;
}
