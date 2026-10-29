import romanUrl from './assets/fonts/OldStandard-Regular.ttf?url';
import { TYPE } from './book-text.js';
import { distressPressInk } from './press-ink.js';

// Old Standard TT, Alexey Kryukov / Old Standard Project, SIL OFL 1.1.
// A freely licensed Modern-style Roman; source and scan notes are in
// public/book-references.txt. The upstream font itself is unmodified.
export const BOOK_FAMILY = 'Wildfell Book Roman';
export const BOOK_FONT = `${TYPE.fontSize}px "${BOOK_FAMILY}", Georgia, serif`;
let fontReady;
export function loadBookFont() {
  fontReady ??= new FontFace(BOOK_FAMILY, `url("${romanUrl}")`, {
    style: 'normal', weight: '400',
  }).load().then(face => { document.fonts.add(face); return face; });
  return fontReady;
}

export function createInkLayer(page, index, scale, paperHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(TYPE.width * scale); canvas.height = Math.round(TYPE.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(scale, scale); ctx.font = BOOK_FONT; ctx.fontKerning = 'normal';
  ctx.fillStyle = ctx.strokeStyle = '#10100f'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = .16;
  // Metal type shares a baseline. The outline acquires a very small ink
  // squeeze; pressure and paper tooth then vary within each impression.
  for (const line of page.lines) for (const run of line.runs) {
    ctx.strokeText(run.text, TYPE.left + run.x, line.y);
    ctx.fillText(run.text, TYPE.left + run.x, line.y);
  }
  return distressPressInk(canvas, index + 57, scale, paperHeight, 'book');
}

export function createImpressedPaper(base, ink, mirrored, impression = 6) {
  // Very shallow paper compression beneath the same ink mask; the letters
  // remain absorbed ink, with no raised bevel or artificial drop shadow.
  const canvas = document.createElement('canvas'); canvas.width = TYPE.width; canvas.height = TYPE.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(ink, 0, 0, TYPE.width, TYPE.height);
  const coverage = ctx.getImageData(0, 0, TYPE.width, TYPE.height).data;
  ctx.clearRect(0, 0, TYPE.width, TYPE.height); ctx.drawImage(base, 0, 0, TYPE.width, TYPE.height);
  const height = ctx.getImageData(0, 0, TYPE.width, TYPE.height);
  for (let i = 0; i < height.data.length; i += 4) {
    const value = height.data[i] - coverage[i + 3] / 255 * impression;
    height.data[i] = height.data[i + 1] = height.data[i + 2] = value;
  }
  ctx.putImageData(height, 0, 0);
  if (mirrored) {
    ctx.globalCompositeOperation = 'copy'; ctx.setTransform(-1, 0, 0, 1, TYPE.width, 0);
    ctx.drawImage(canvas, 0, 0);
  }
  return canvas;
}
