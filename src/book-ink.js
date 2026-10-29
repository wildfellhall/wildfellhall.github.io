import typewriterUrl from './assets/fonts/TT2020StyleE-Regular.woff2?url';
import { TYPE } from './book-text.js';

// TT2020 Style E by Fredrick R. Brennan, SIL OFL 1.1 (included in public/ornaments).
// Unmodified upstream font: github.com/ctrlcctrlv/TT2020, commit 0cf038022b1d541381744a8969a58d55110a0a23.
export const TYPEWRITER_FAMILY = 'Wildfell Typewriter';
export const TYPEWRITER_FONT = `${TYPE.fontSize}px "${TYPEWRITER_FAMILY}", monospace`;
let fontReady;
export function loadTypewriter() {
  // Load the actual font before measuring or rasterizing any pages. Checking
  // document.fonts.check() alone can succeed even for an unknown family.
  fontReady ??= new FontFace(TYPEWRITER_FAMILY, `url("${typewriterUrl}")`, {
    style: 'normal', weight: '400', featureSettings: '"calt" 1',
  }).load().then(face => { document.fonts.add(face); return face; });
  return fontReady;
}

function noise(x, y, seed) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}

export function createInkLayer(page, index, scale, paperHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(TYPE.width * scale); canvas.height = Math.round(TYPE.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(scale, scale); ctx.font = TYPEWRITER_FONT; ctx.fontKerning = 'none';
  ctx.fillStyle = '#111216'; ctx.textBaseline = 'alphabetic';
  const pitch = ctx.measureText('M').width;
  for (const line of page.lines) {
    // Whole runs preserve TT2020's nine contextual variants. Drawing one
    // character at a time would silently discard its alternate impressions.
    ctx.save();
    ctx.translate(line.x + (noise(0, line.y, index) - .5) * .65, line.y + (noise(1, line.y, index) - .5) * .8);
    ctx.rotate((noise(2, line.y, index) - .5) * .0008);
    ctx.fillText(line.text, 0, 0); ctx.restore();
  }
  const ink = ctx.getImageData(0, 0, canvas.width, canvas.height), p = ink.data;
  const top = Math.max(0, Math.floor((TYPE.top - 10) * scale));
  const bottom = Math.min(canvas.height, Math.ceil((page.lines.at(-1).y + 12) * scale));
  const { data, width, height } = paperHeight;
  for (let y = top; y < bottom; y++) for (let x = Math.floor(TYPE.left * scale) - 8; x < Math.ceil(TYPE.right * scale) + 8; x++) {
    const i = (y * canvas.width + x) * 4;
    if (!p[i + 3]) continue;
    const u = x / scale, v = y / scale;
    const column = Math.floor((u - TYPE.left) / pitch);
    const row = Math.floor((v - TYPE.top - TYPE.fontSize * .15) / TYPE.lineHeight);
    const pressure = .91 + noise(column, row, index + 41) * .09;
    const fibres = data[(Math.min(height - 1, Math.floor(v / TYPE.height * height)) * width
      + Math.min(width - 1, Math.floor(u / TYPE.width * width))) * 4];
    const grain = noise(x, y, index + 17);
    const patch = noise(Math.floor(u * 1.8), Math.floor(v * 2.1), index + 83);
    // Partial ribbon contact leaves pale fibres and tiny voids *inside* ink,
    // rather than stamping the same clean outline with a lower opacity.
    const contact = patch < .045 ? .22 + grain * .30 : .94 + grain * .06;
    const fibreContact = Math.max(.72, Math.min(1.04, 1 + (fibres - 128) * .007));
    p[i + 3] *= pressure * contact * fibreContact;
  }
  ctx.putImageData(ink, 0, 0);
  return canvas;
}

export function createImpressedPaper(base, ink, mirrored) {
  // Very shallow paper compression beneath the same ink mask; the letters
  // remain absorbed ink, with no raised bevel or artificial drop shadow.
  const canvas = document.createElement('canvas'); canvas.width = TYPE.width; canvas.height = TYPE.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(ink, 0, 0, TYPE.width, TYPE.height);
  const coverage = ctx.getImageData(0, 0, TYPE.width, TYPE.height).data;
  ctx.clearRect(0, 0, TYPE.width, TYPE.height); ctx.drawImage(base, 0, 0, TYPE.width, TYPE.height);
  const height = ctx.getImageData(0, 0, TYPE.width, TYPE.height);
  for (let i = 0; i < height.data.length; i += 4) {
    const value = height.data[i] - coverage[i + 3] / 255 * 14;
    height.data[i] = height.data[i + 1] = height.data[i + 2] = value;
  }
  ctx.putImageData(height, 0, 0);
  if (mirrored) {
    ctx.globalCompositeOperation = 'copy'; ctx.setTransform(-1, 0, 0, 1, TYPE.width, 0);
    ctx.drawImage(canvas, 0, 0);
  }
  return canvas;
}
