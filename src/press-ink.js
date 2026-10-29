import { paperNoise } from './paper-stock.js';

const canvasLike = source => {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; return canvas;
};

export function distressPressInk(canvas, seed, scale, paperHeight, finish = 'newspaper') {
  const book = finish === 'book';
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), p = pixels.data;
  const original = book ? p.slice() : null, stride = canvas.width * 4;
  const alphaAt = (x, y) => {
    const left = Math.floor(x), top = Math.floor(y), dx = x - left, dy = y - top;
    if (left < 0 || top < 0 || left + 1 >= canvas.width || top + 1 >= canvas.height) return 0;
    const i = (top * canvas.width + left) * 4 + 3;
    return (original[i] * (1 - dx) + original[i + 4] * dx) * (1 - dy)
      + (original[i + stride] * (1 - dx) + original[i + stride + 4] * dx) * dy;
  };
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    if (!p[i + 3] && !(book && (original[i - 1] || original[i + 7] || original[i + 3 - stride] || original[i + 3 + stride]))) continue;
    const u = x / scale, v = y / scale;
    // Irregular inking is shared by small patches of a metal sort, rather
    // than lowering the opacity of the entire typeset line uniformly.
    const pressure = paperNoise(Math.floor(u / 9), Math.floor(v / 6), seed + 3);
    const tooth = paperNoise(Math.floor(u * 2), Math.floor(v * 2), seed + 9);
    const fibre = paperHeight.data[(Math.min(paperHeight.height - 1, Math.floor(y / canvas.height * paperHeight.height)) * paperHeight.width
      + Math.min(paperHeight.width - 1, Math.floor(x / canvas.width * paperHeight.width))) * 4];
    if (book) {
      // Small contour variations model ink meeting uneven paper, without
      // moving letters off their common typeset baseline or blurring them.
      const dx = ((pressure - .5) * .38 + (fibre - 128) * .002) * scale;
      const dy = (paperNoise(Math.floor(u / 5), Math.floor(v / 4), seed + 15) - .5) * .34 * scale;
      p[i + 3] = alphaAt(x + dx, y + dy);
      p[i] = 16; p[i + 1] = 16; p[i + 2] = 15;
    }
    // Most of the impression is solid carbon black. Only high paper fibres
    // and occasional under-inked sorts interrupt the coverage; the cream
    // stock must not wash through every letter and turn the type brown.
    const missedFibre = fibre > (book ? 145 : 139) && tooth < (book ? .07 : .11) || tooth < (book ? .002 : .004);
    const contact = missedFibre ? .38 : 1;
    p[i + 3] *= (pressure < (book ? .05 : .08) ? (book ? .94 : .89) + pressure : .985) * contact;
  }
  ctx.putImageData(pixels, 0, 0);
  const result = canvasLike(canvas), paint = result.getContext('2d');
  paint.globalAlpha = book ? .12 : .16; paint.filter = `blur(${.22 * scale}px)`;
  paint.drawImage(canvas, .08 * scale, .04 * scale);
  // Bookwork has a quieter impression than newsprint: retain the fine serif
  // hairlines while sharing the same paper-dependent letterpress treatment.
  paint.filter = `blur(${.3 * scale}px)`; paint.globalAlpha = book ? .07 : .13;
  for (let band = 0, y = 0; y < canvas.height; band++, y += 43 * scale) {
    if (paperNoise(band, 8, seed) > (book ? .035 : .09)) continue;
    const x = paperNoise(band, 2, seed) * canvas.width;
    const w = Math.min(canvas.width - x, 45 * scale), h = Math.min(canvas.height - y, 4 * scale);
    paint.drawImage(canvas, x, y, w, h, x + (book ? .32 : .55) * scale, y, w, h);
  }
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
