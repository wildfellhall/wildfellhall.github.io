import * as THREE from 'three';
import '@fontsource/old-standard-tt/400.css';
import { TYPE, paginateBookText } from './book-text.js';
import { drawPageOrnaments } from './book-page-ornaments.js';
import { LEAF_COUNT } from './book-motion.js';

// A revival of the modern serif types used in late nineteenth-century books:
// https://github.com/akryukov/oldstand (locally served, SIL Open Font License).
export async function createBookPages(paper, source) {
  const font = `${TYPE.fontSize}px "Old Standard TT", "Times New Roman", serif`;
  try { await document.fonts.load(font, source || 'Aa Éé'); }
  catch (error) { console.warn('Using the book’s serif fallback:', error); }
  const measure = document.createElement('canvas').getContext('2d'); measure.font = font;
  const pages = paginateBookText(source, text => measure.measureText(text).width);
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
    ctx.font = font; ctx.fillStyle = '#382c24'; ctx.textBaseline = 'alphabetic';
    for (const line of pages[index]?.lines || []) {
      const words = line.text.split(' '), available = TYPE.right - line.x;
      const extra = (available - ctx.measureText(line.text).width) / Math.max(1, words.length - 1);
      // Tight justified setting, without conspicuous rivers in short lines.
      if (!line.paragraphEnd && words.length > 1 && extra < TYPE.fontSize * .25) {
        let x = line.x; const space = ctx.measureText(' ').width + extra;
        for (const word of words) { ctx.fillText(word, x, line.y); x += ctx.measureText(word).width + space; }
      } else ctx.fillText(line.text, line.x, line.y);
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
