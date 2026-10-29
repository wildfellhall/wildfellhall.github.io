import * as THREE from 'three';
import { createPaperStock } from './paper-stock.js';

// Material references (photographs studied, not used as textures):
// https://www.blackheathbooks.com.au/product-page/glossary-of-ecclesiastical-ornament-and-costume-pugin-1844
// https://victorianweb.org/art/design/books/leather/20.html
// https://www.reedgallery.co.nz/exhibitions/plain-to-ornate-bookbindings-from-the-reed-collection/7
function random(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function hash(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function softNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
  const a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), a),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), a), b) - .5;
}
function texture(bytes, size, colour = false) {
  const map = new THREE.DataTexture(bytes, size, size);
  map.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter; map.anisotropy = 4; map.needsUpdate = true;
  return map;
}

export function createBookMaterials() {
  const size = 1024, colour = new Uint8Array(size * size * 4);
  const height = new Uint8Array(colour.length), roughness = new Uint8Array(colour.length);
  const rng = random(1848);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // Small irregular grains, with narrower creases between them. Fine pores
    // sit above this structure instead of making the leather look like noise.
    const u = (x + softNoise(x / 70, y / 95) * 10) / 8.8;
    const v = (y + softNoise(x / 90 + 17, y / 60) * 10) / 11.2, ix = Math.floor(u), iy = Math.floor(v);
    let first = 9, second = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const a = ix + dx, b = iy + dy;
      const d = Math.hypot(u - a - hash(a, b), v - b - hash(a + 93, b + 157));
      if (d < first) { second = first; first = d; } else if (d < second) second = d;
    }
    const grain = THREE.MathUtils.smoothstep(second - first, 0, .32);
    const pore = rng() - .5;
    const mottling = Math.sin(x * .024 + Math.sin(y * .017)) * .035 + Math.sin(y * .031 + x * .008) * .025;
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / size;
    const wear = Math.exp(-edge * 170) * (.35 + rng() * .45);
    const joint = Math.exp(-(((x / size - .047) / .006) ** 2));
    const tone = 1 + mottling + (grain - .5) * .20 + pore * .035 - joint * .13;
    const i = (y * size + x) * 4;
    colour.set([83 * tone + wear * 42, 26 * tone + wear * 24, 39 * tone + wear * 14, 255], i);
    const h = 78 + grain * 108 + pore * 10 - joint * 48;
    height.set([h, h, h, 255], i);
    const r = 163 + (1 - grain) * 64 + pore * 12 - wear * 28;
    roughness.set([r, r, r, 255], i);
  }
  // Tangent-space normals keep the pebbled relief legible under the room's
  // broad window lighting, including when the smaller book is seen obliquely.
  const normals = new Uint8Array(colour.length);
  const h = (x, y) => height[(Math.max(0, Math.min(size - 1, y)) * size + Math.max(0, Math.min(size - 1, x))) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (h(x - 1, y) - h(x + 1, y)) * 1.1, ny = (h(x, y - 1) - h(x, y + 1)) * 1.1;
    const length = Math.hypot(nx, ny, 1);
    normals.set([(nx / length * .5 + .5) * 255, (ny / length * .5 + .5) * 255, (1 / length * .5 + .5) * 255, 255], (y * size + x) * 4);
  }
  const leather = new THREE.MeshPhysicalMaterial({ map: texture(colour, size, true), bumpMap: texture(height, size), normalMap: texture(normals, size),
    roughnessMap: texture(roughness, size), bumpScale: .018, roughness: .76, metalness: 0,
    clearcoat: .06, clearcoatRoughness: .65 });
  for (const map of [leather.map, leather.bumpMap, leather.normalMap, leather.roughnessMap]) map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const gold = new THREE.MeshStandardMaterial({ color: '#e7c478', metalness: .90, roughness: .34, envMapIntensity: 1.4,
    bumpMap: leather.bumpMap, bumpScale: .00025 });
  const paper = [0, 1, 2].map(seed => createPaperStock(seed));
  const edgeSize = 512, edgePixels = new Uint8Array(edgeSize * edgeSize * 4), edgeHeights = new Uint8Array(edgePixels.length);
  for (let y = 0; y < edgeSize; y++) for (let x = 0; x < edgeSize; x++) {
    const layers = y / edgeSize * 48, distance = Math.abs(layers - Math.round(layers));
    const line = Math.exp(-((distance / .13) ** 2));
    const fibre = softNoise(x / 8, y / 3) * 3, age = softNoise(x / 77, y / 71) * 5;
    const shade = fibre + age - line * 8, i = (y * edgeSize + x) * 4;
    edgePixels.set([235 + shade, 228 + shade, 208 + shade, 255], i);
    const height = 145 - line * 24 + fibre; edgeHeights.set([height, height, height, 255], i);
  }
  const edges = new THREE.MeshStandardMaterial({ map: texture(edgePixels, edgeSize, true), bumpMap: texture(edgeHeights, edgeSize), bumpScale: .00045, roughness: .97 });
  return { leather, gold, paper, edges };
}
