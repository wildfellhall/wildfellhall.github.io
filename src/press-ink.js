import { paperNoise } from './paper-stock.js';

const canvasLike = source => {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; return canvas;
};

export function distressPressInk(canvas, seed, scale, paperHeight) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), p = pixels.data;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4; if (!p[i + 3]) continue;
    const u = x / scale, v = y / scale;
    // Irregular inking is shared by small patches of a metal sort, rather
    // than lowering the opacity of the entire typeset line uniformly.
    const pressure = paperNoise(Math.floor(u / 13), Math.floor(v / 8), seed + 3);
    const tooth = paperNoise(Math.floor(u * 2), Math.floor(v * 2), seed + 9);
    const fibre = paperHeight.data[(Math.min(paperHeight.height - 1, Math.floor(y / canvas.height * paperHeight.height)) * paperHeight.width
      + Math.min(paperHeight.width - 1, Math.floor(x / canvas.width * paperHeight.width))) * 4];
    const contact = tooth < .035 ? .25 : Math.min(1, .92 + (fibre - 124) * .006);
    p[i + 3] *= (.84 + pressure * .16) * contact;
  }
  ctx.putImageData(pixels, 0, 0);
  return spreadInk(canvas, seed, scale);
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
