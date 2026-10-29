import * as THREE from 'three';
import '@fontsource/courier-prime/400.css';
import { TYPE, paginateBookText } from './book-text.js';
import { drawPageOrnaments } from './book-page-ornaments.js';
import { LEAF_COUNT } from './book-motion.js';

// Fixed-pitch typewriter lettering, locally served under the SIL OFL.
// Repeatable variations in ribbon pressure keep the ink stable when returning
// to a page, while letting individual strikes have slightly different weight.
function ribbonPressure(seed) {
  let n = Math.imul(seed ^ 1848, 374761393);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}

export async function createBookPages(paper, source) {
  const font = `${TYPE.fontSize}px "Courier Prime", "Courier New", monospace`;
  try { await document.fonts.load(font, source || 'Aa Éé'); }
  catch (error) { console.warn('Using the book’s typewriter fallback:', error); }
  const measure = document.createElement('canvas').getContext('2d'); measure.font = font;
  measure.fontKerning = 'none';
  const pages = paginateBookText(source, text => measure.measureText(text).width);
  const graphemes = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : { segment: text => Array.from(text.normalize('NFC'), segment => ({ segment })) };
  const cache = new Map();
  const backgrounds = paper.map(material => {
    const { data, width, height } = material.map.image;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    return canvas;
  });
  function get(index) {
    if (cache.has(index)) { const value = cache.get(index); cache.delete(index); cache.set(index, value); return value; }
    const seed = ((index % paper.length) + paper.length) % paper.length;
    const canvas = document.createElement('canvas'); canvas.width = TYPE.width; canvas.height = TYPE.height;
    const ctx = canvas.getContext('2d');
    // UVs run outwards from the sewn edge on both faces of a leaf. Printing a
    // verso in reverse texture coordinates makes the visible text read LTR.
    if (Math.abs(index % 2) === 1) { ctx.translate(TYPE.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(backgrounds[seed], 0, 0, TYPE.width, TYPE.height);
    drawPageOrnaments(ctx, TYPE.width, TYPE.height);
    ctx.font = font; ctx.fontKerning = 'none'; ctx.fillStyle = '#302e2a'; ctx.textBaseline = 'alphabetic';
    for (const [row, line] of (pages[index]?.lines || []).entries()) {
      let x = line.x, column = 0;
      // A typewriter advances a fixed carriage: keep ordinary spaces and a
      // ragged right edge instead of stretching words to justify each line.
      for (const { segment } of graphemes.segment(line.text)) {
        const strike = index * 7919 + row * 131 + column++;
        ctx.globalAlpha = .81 + ribbonPressure(strike) * .18;
        const baseline = (ribbonPressure(strike + 4421) - .5) * .65;
        ctx.fillText(segment, x, line.y + baseline);
        x += ctx.measureText(segment).width;
      }
    }
    // Let a small amount of the actual paper mottling show through the ink.
    ctx.globalAlpha = .055; ctx.drawImage(backgrounds[seed], 0, 0, TYPE.width, TYPE.height); ctx.globalAlpha = 1;
    const material = paper[seed].clone();
    material.map = new THREE.CanvasTexture(canvas); material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.anisotropy = 8; material.name = `printed-page-${index + 1}`;
    cache.set(index, material); return material;
  }
  return {
    pages, get, leafCount: Math.max(LEAF_COUNT, Math.ceil(pages.length / 2)),
    prune(active) {
      // Keep only a few neighbouring leaves on the GPU, even for long books.
      for (const [index, material] of cache) {
        if (cache.size <= 8) break;
        if (active.has(index)) continue;
        material.map.dispose(); material.dispose(); cache.delete(index);
      }
    },
  };
}
