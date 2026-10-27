import * as THREE from 'three';

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
  const gold = new THREE.MeshStandardMaterial({ color: '#e7c478', metalness: .90, roughness: .34, envMapIntensity: 1.4,
    bumpMap: leather.bumpMap, bumpScale: .00025 });
  const paper = [0, 1, 2].map(seed => paperMaterial(seed));
  const edgeCanvas = document.createElement('canvas'); edgeCanvas.width = 512; edgeCanvas.height = 256;
  const ctx = edgeCanvas.getContext('2d'); ctx.fillStyle = '#d5c6a4'; ctx.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y++) {
    const shade = 166 + rng() * 40;
    ctx.fillStyle = `rgb(${shade + 24} ${shade + 13} ${shade - 14})`;
    ctx.fillRect(0, y, 512, .4 + rng() * .45);
  }
  const edgeMap = new THREE.CanvasTexture(edgeCanvas); edgeMap.colorSpace = THREE.SRGBColorSpace;
  const edges = new THREE.MeshStandardMaterial({ map: edgeMap, roughness: .93 });
  return { leather, gold, paper, edges };
}

function paperMaterial(seed) {
  const size = 768, rng = random(1870 + seed * 173), pixels = new Uint8Array(size * size * 4), heights = new Uint8Array(pixels.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / size;
    const age = Math.exp(-edge * 35) * 15, grain = (rng() - .5) * 3;
    const cloud = softNoise(x / 80 + seed * 19, y / 100) * 9 + softNoise(x / 27, y / 31 + seed * 23) * 3;
    const i = (y * size + x) * 4;
    pixels.set([235 - age * .7 + grain + cloud, 225 - age + grain + cloud, 201 - age * 1.4 + grain + cloud, 255], i);
    const h = 126 + grain * 6; heights.set([h, h, h, 255], i);
  }
  // Sparse, diffuse foxing stays near the margins. The writing area is blank.
  for (let spot = 0; spot < 95; spot++) {
    let x = rng() * size, y = rng() * size;
    if (spot < 75) {
      if (spot % 2) x = rng() < .5 ? rng() * 75 : size - rng() * 75;
      else y = rng() < .5 ? rng() * 75 : size - rng() * 75;
    }
    const radius = 1 + rng() * 5;
    for (let yy = Math.max(0, Math.floor(y - radius * 3)); yy < Math.min(size, y + radius * 3); yy++) {
      for (let xx = Math.max(0, Math.floor(x - radius * 3)); xx < Math.min(size, x + radius * 3); xx++) {
        const amount = Math.exp(-((xx - x) ** 2 + (yy - y) ** 2) / radius ** 2) * (spot < 75 ? 22 : 11);
        const i = (yy * size + xx) * 4;
        pixels[i] -= amount * .55; pixels[i + 1] -= amount; pixels[i + 2] -= amount * 1.1;
      }
    }
  }
  return new THREE.MeshStandardMaterial({ map: texture(pixels, size, true), bumpMap: texture(heights, size),
    bumpScale: .00035, roughness: .96, side: THREE.DoubleSide });
}
