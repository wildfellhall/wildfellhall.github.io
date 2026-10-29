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
  if (!newspaper) return createBookPaper(seed);
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
    const h = 128 + tooth * (newspaper ? .57 : 1) + pulp * (newspaper ? 5 : 12) + laid * (newspaper ? .4 : 1.3);
    const tone = tooth * (newspaper ? .07 : .14) + pulp * (newspaper ? 1.8 : 3) + broad * 4;
    pixels.set(newspaper ? [239 + tone - age * .45, 234 + tone - age * .7, 221 + tone - age, 255]
      : [239 + tone - age * .6, 234 + tone - age, 219 + tone - age * 1.4, 255], i);
    heights.set([h, h, h, 255], i);
    const r = 228 + tooth * .35; rough.set([r, r, r, 255], i);
  }
  // Individual fibres have tapering, irregular edges and variable lengths.
  // They remain small even at reading magnification, as on real rag paper.
  for (let fibre = 0; fibre < 21000; fibre++) {
    const x = paperNoise(fibre, 1, seed) * size, y = paperNoise(fibre, 2, seed) * size;
    const angle = paperNoise(fibre, 3, seed) * Math.PI * 2, length = 2 + paperNoise(fibre, 4, seed) * (newspaper ? 4 : 10);
    const shade = (paperNoise(fibre, 5, seed) - .52) * (newspaper ? 7 : 16);
    for (let s = 0; s < length; s += .5) {
      const xx = Math.round(x + Math.cos(angle) * s), yy = Math.round(y + Math.sin(angle) * s + Math.sin(s * .5) * .3);
      if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
      const i = (yy * size + xx) * 4, taper = Math.sin(Math.PI * s / length);
      for (let c = 0; c < 3; c++) { pixels[i + c] = Math.min(255, pixels[i + c] + shade * taper); heights[i + c] = Math.min(255, heights[i + c] + (newspaper ? 7 : 13) * taper); }
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

function createBookPaper(seed) {
  const size = 1024, count = size * size * 4;
  const colour = new Float32Array(count), relief = new Float32Array(size * size);
  const roughness = new Uint8Array(count);
  // Work in the physical page's proportions: a fibre should not stretch
  // vertically when the square texture is mapped onto a tall book leaf.
  const aspect = 1425 / 1024;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = y * aspect, i = (y * size + x) * 4;
    const tooth = cloud(x / 1.7, v / 2.1, seed + 3) * 24 + (paperNoise(x, y, seed) - .5) * 5;
    const pulp = cloud(x / 13, v / 18, seed + 4);
    const formation = cloud(x / 48, v / 62, seed + 19) * 18
      + cloud(x / 155, v / 190, seed + 27) * 20 + cloud(x / 370, v / 450, seed + 39) * 12;
    const warmth = cloud(x / 94, v / 120, seed + 43) * 2.8;
    // Oxidation wanders inward from the three cut edges. The sewn edge is
    // protected, so there is no dark rectangular vignette around each leaf.
    const edge = Math.min(size - 1 - x, v, (size - 1 - y) * aspect);
    const ageWidth = 38 + cloud(x / 77, v / 95, seed + 51) * 34;
    const age = Math.exp(-edge / ageWidth) * (5.5 + cloud(x / 19, v / 31, seed + 56) * 4);
    const tone = formation + pulp * 3.8 + tooth * .28;
    colour.set([238 + tone * .7 - age * .48, 231 + tone * .84 - age * .86 - warmth * .3,
      214 + tone - age * 1.4 - warmth, 255], i);
    // Faint mould traces and compressed pulp sit below the short fibres.
    const laid = Math.cos((v + cloud(x / 74, v / 81, seed + 62) * 1.7) * Math.PI / 2.6);
    relief[y * size + x] = 128 + tooth + pulp * 6 + laid * .55;
    const r = 238 + pulp * 12 + cloud(x / 41, v / 57, seed + 68) * 9 + tooth * .2;
    roughness.set([r, r, r, 255], i);
  }
  // Subpixel coverage embeds short, curved fibres in the sheet. Rounding
  // every sample to a pixel used to build raised, bright splinters of pulp.
  for (let fibre = 0; fibre < 54000; fibre++) {
    const x = paperNoise(fibre, 1, seed) * size, y = paperNoise(fibre, 2, seed) * size * aspect;
    const angle = paperNoise(fibre, 3, seed) * Math.PI * 2;
    const length = 1.4 + paperNoise(fibre, 4, seed) ** 2 * 6.5;
    const shade = (paperNoise(fibre, 5, seed) - .55) * 10;
    const depth = (paperNoise(fibre, 6, seed) - .38) * 11;
    const bend = (paperNoise(fibre, 7, seed) - .5) * .8;
    for (let s = 0; s < length; s += .65) {
      const curve = Math.sin(s / length * Math.PI) * bend, taper = Math.sin(s / length * Math.PI);
      const xx = x + Math.cos(angle) * s - Math.sin(angle) * curve;
      const yy = (y + Math.sin(angle) * s + Math.cos(angle) * curve) / aspect;
      const left = Math.floor(xx), top = Math.floor(yy), fx = xx - left, fy = yy - top;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const px = left + dx, py = top + dy;
        if (px < 0 || py < 0 || px >= size || py >= size) continue;
        const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * taper;
        const p = py * size + px;
        for (let c = 0; c < 3; c++) colour[p * 4 + c] += shade * weight;
        relief[p] += depth * weight;
      }
    }
  }
  // Sparse oxidation flecks belong mainly to exposed margins. Their soft,
  // irregular edges avoid the repeated dark dots of a noise overlay.
  for (let spot = 0; spot < 165; spot++) {
    const cx = paperNoise(spot, 10, seed) * size, cy = paperNoise(spot, 11, seed) * size;
    const edge = Math.min(size - cx, cy * aspect, (size - cy) * aspect);
    if (edge > 115 && paperNoise(spot, 12, seed) > .06) continue;
    const radius = .45 + paperNoise(spot, 13, seed) ** 2 * 2.4;
    const intensity = 3 + paperNoise(spot, 14, seed) * 10;
    for (let y = Math.max(0, Math.floor(cy - radius * 2)); y <= Math.min(size - 1, cy + radius * 2); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius * 2)); x <= Math.min(size - 1, cx + radius * 2); x++) {
        const distance = ((x - cx) ** 2 + ((y - cy) * aspect) ** 2) / (radius * radius);
        const stain = Math.exp(-distance * 1.9) * intensity * (.8 + paperNoise(x, y, seed + 74) * .4);
        const i = (y * size + x) * 4;
        colour[i] -= stain * .6; colour[i + 1] -= stain; colour[i + 2] -= stain * 1.45;
      }
    }
  }
  const pixels = new Uint8Array(new Uint8ClampedArray(colour)), heights = new Uint8Array(count);
  for (let p = 0; p < relief.length; p++) {
    const height = Math.max(0, Math.min(255, Math.round(relief[p])));
    heights.set([height, height, height, 255], p * 4);
  }
  return new THREE.MeshPhysicalMaterial({ map: map(pixels, size, true), bumpMap: map(heights, size),
    roughnessMap: map(roughness, size), bumpScale: .0052, roughness: 1,
    metalness: 0, specularIntensity: .035, sheen: 0, side: THREE.DoubleSide });
}

export function canvasFromMap(texture) {
  const { data, width, height } = texture.image;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas;
}
