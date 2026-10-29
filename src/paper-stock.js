import * as THREE from 'three';

export function paperNoise(x, y, seed = 0) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
function cloud(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
  const a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(paperNoise(ix, iy, seed), paperNoise(ix + 1, iy, seed), a),
    THREE.MathUtils.lerp(paperNoise(ix, iy + 1, seed), paperNoise(ix + 1, iy + 1, seed), a), b) - .5;
}
function map(bytes, size, colour = false) {
  const result = new THREE.DataTexture(bytes, size, size);
  result.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  result.generateMipmaps = true; result.minFilter = THREE.LinearMipmapLinearFilter;
  result.magFilter = THREE.LinearFilter; result.anisotropy = 8; result.needsUpdate = true;
  return result;
}

// Rag fibres and the much finer compressed pulp have separate scales. Colour
// records slight ageing; the height field carries the physical tooth, so it
// changes with the light instead of looking like painted-on brown speckles.
export function createPaperStock(seed = 0, newspaper = false) {
  const size = 1024, pixels = new Uint8Array(size * size * 4), heights = new Uint8Array(pixels.length);
  const rough = new Uint8Array(pixels.length), normals = new Uint8Array(pixels.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, edge = Math.min(x, y, size - 1 - x, size - 1 - y);
    const tooth = cloud(x / 2.3, y / 3.1, seed + 3) * 29 + (paperNoise(x, y, seed) - .5) * 14;
    const pulp = cloud(x / 21, y / 26, seed + 4), broad = cloud(x / 170, y / 210, seed + 19);
    const age = Math.exp(-edge / 19) * (4 + cloud(x / 17, y / 13, seed) * 5);
    // An almost imperceptible remnant of the paper mould. Neither a fabric
    // grid nor a conspicuous stripe is printed onto the writing area.
    const laid = Math.cos((y + cloud(x / 80, y / 50, seed) * 2) * Math.PI / 3.4);
    const h = 128 + tooth + pulp * 12 + laid * 1.3;
    const tone = tooth * .14 + pulp * 3 + broad * 4;
    pixels.set([239 + tone - age * .6, 234 + tone - age, (newspaper ? 216 : 219) + tone - age * 1.4, 255], i);
    heights.set([h, h, h, 255], i);
    const r = 228 + tooth * .35; rough.set([r, r, r, 255], i);
  }
  // Individual fibres have tapering, irregular edges and variable lengths.
  // They remain small even at reading magnification, as on real rag paper.
  for (let fibre = 0; fibre < 21000; fibre++) {
    const x = paperNoise(fibre, 1, seed) * size, y = paperNoise(fibre, 2, seed) * size;
    const angle = paperNoise(fibre, 3, seed) * Math.PI * 2, length = 2 + paperNoise(fibre, 4, seed) * 10;
    const shade = (paperNoise(fibre, 5, seed) - .52) * 16;
    for (let s = 0; s < length; s += .5) {
      const xx = Math.round(x + Math.cos(angle) * s), yy = Math.round(y + Math.sin(angle) * s + Math.sin(s * .5) * .3);
      if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
      const i = (yy * size + xx) * 4, taper = Math.sin(Math.PI * s / length);
      for (let c = 0; c < 3; c++) { pixels[i + c] = Math.min(255, pixels[i + c] + shade * taper); heights[i + c] = Math.min(255, heights[i + c] + 13 * taper); }
    }
  }
  // Restrained oxidation at cut edges, with tiny hard flecks rather than
  // large blurred stains which made the previous paper resemble parchment.
  for (let spot = 0; spot < 125; spot++) {
    const x = Math.floor(paperNoise(spot, 6, seed) * size), y = Math.floor(paperNoise(spot, 7, seed) * size);
    if (Math.min(x, y, size - x, size - y) > 74) continue;
    const i = (y * size + x) * 4;
    pixels[i] -= 14; pixels[i + 1] -= 21; pixels[i + 2] -= 28;
  }
  const heightAt = (x, y) => heights[(THREE.MathUtils.clamp(y, 0, size - 1) * size + THREE.MathUtils.clamp(x, 0, size - 1)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (heightAt(x - 1, y) - heightAt(x + 1, y)) * .7, ny = (heightAt(x, y - 1) - heightAt(x, y + 1)) * .7;
    const length = Math.hypot(nx, ny, 1);
    normals.set([(nx / length * .5 + .5) * 255, (ny / length * .5 + .5) * 255, (1 / length * .5 + .5) * 255, 255], (y * size + x) * 4);
  }
  return new THREE.MeshPhysicalMaterial({ map: map(pixels, size, true), bumpMap: map(heights, size),
    normalMap: map(normals, size), roughnessMap: map(rough, size), bumpScale: .0032,
    roughness: 1, metalness: 0, specularIntensity: .16, sheen: .10, sheenRoughness: 1,
    sheenColor: new THREE.Color('#eee6d8'), side: THREE.DoubleSide });
}

export function canvasFromMap(texture) {
  const { data, width, height } = texture.image;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas;
}
