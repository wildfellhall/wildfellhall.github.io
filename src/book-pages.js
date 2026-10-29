import * as THREE from 'three';
import { TYPE, paginateBookText } from './book-text.js';
import { drawPageOrnaments } from './book-page-ornaments.js';
import { LEAF_COUNT } from './book-motion.js';
import { BOOK_FONT, loadBookFont, createInkLayer, createImpressedPaper } from './book-ink.js';

export async function createBookPages(paper, source, maxTextureSize = 4096) {
  try { await loadBookFont(); }
  catch (error) { console.warn('Using the book’s serif fallback:', error); }
  const measure = document.createElement('canvas').getContext('2d'); measure.font = BOOK_FONT;
  measure.fontKerning = 'normal';
  const pages = paginateBookText(source, text => measure.measureText(text).width);
  const cache = new Map();
  function canvasFromMap(map) {
    const { data, width, height } = map.image;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    return canvas;
  }
  const backgrounds = paper.map(material => canvasFromMap(material.map));
  const paperHeights = paper.map(material => canvasFromMap(material.bumpMap));
  const paperRoughness = paper.map(material => canvasFromMap(material.roughnessMap));
  function get(index) {
    if (cache.has(index)) { const value = cache.get(index); cache.delete(index); cache.set(index, value); return value; }
    const seed = ((index % paper.length) + paper.length) % paper.length;
    const printed = Boolean(pages[index]?.lines.length), mirrored = Math.abs(index % 2) === 1;
    const scale = printed ? Math.min(2, maxTextureSize / TYPE.height) : 1;
    const canvas = document.createElement('canvas'); canvas.width = Math.round(TYPE.width * scale); canvas.height = Math.round(TYPE.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    // UVs run outwards from the sewn edge on both faces of a leaf. Printing a
    // verso in reverse texture coordinates makes the visible text read LTR.
    if (mirrored) { ctx.translate(TYPE.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(backgrounds[seed], 0, 0, TYPE.width, TYPE.height);
    drawPageOrnaments(ctx, TYPE.width, TYPE.height);
    const material = paper[seed].clone();
    if (printed) {
      const ink = createInkLayer(pages[index], index, scale, paper[seed].bumpMap.image);
      ctx.drawImage(ink, 0, 0, TYPE.width, TYPE.height);
      material.bumpMap = new THREE.CanvasTexture(createImpressedPaper(paperHeights[seed], ink, mirrored));
      material.roughnessMap = new THREE.CanvasTexture(createImpressedPaper(paperRoughness[seed], ink, mirrored, 14));
      material.bumpScale = .0022; material.specularIntensity = .035; material.sheen = 0;
      material.normalMap = null; material.userData.printedBump = true;
    }
    material.map = new THREE.CanvasTexture(canvas); material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.anisotropy = 8; material.name = `printed-page-${index + 1}`;
    cache.set(index, material); return material;
  }
  return {
    pages, get, leafCount: Math.max(LEAF_COUNT, Math.ceil(pages.length / 2)),
    prune(active) {
      // Keep only a few neighbouring leaves on the GPU, even for long books.
      for (const [index, material] of cache) {
        if (cache.size <= 6) break;
        if (active.has(index)) continue;
        material.map.dispose();
        if (material.userData.printedBump) { material.bumpMap.dispose(); material.roughnessMap.dispose(); }
        material.dispose(); cache.delete(index);
      }
    },
  };
}
