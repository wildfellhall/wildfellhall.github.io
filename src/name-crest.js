import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All of the metalwork is modelled in the plaque's plane, with +Z facing out.
// The containing group places this plane flat on the writing surface.
function ovalMolding(rx, ry) {
  const profile = [[-.057, .032], [-.057, .059], [-.043, .071], [-.030, .064],
    [-.016, .055], [0, .069], [.018, .093], [.038, .098], [.060, .080],
    [.073, .056], [.083, .048], [.091, .055], [.100, .050], [.102, .023]];
  const segments = 320, positions = [], uv = [], indices = [], n = profile.length;
  for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
    const normal = new THREE.Vector2(c / rx, s / ry).normalize();
    for (let j = 0; j < n; j++) {
      const [offset, z] = profile[j], x = rx * c + normal.x * offset, y = ry * s + normal.y * offset;
      positions.push(x, y, z); uv.push(x * 2, y * 2);
      const a = i * n + j, b = (i + 1) % segments * n + j;
      const d = (i + 1) % segments * n + (j + 1) % n, e = i * n + (j + 1) % n;
      indices.push(a, e, b, b, e, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// Close both sides of the curled petals and leaves. Their turned edges have
// actual thickness, so oblique views never reveal a missing back face.
function reliefSurface(rows, columns, surface, thickness) {
  const positions = [], uv = [], indices = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
    const t = (i + .01) / (rows + .02), s = j / columns * 2 - 1;
    positions.push(...surface(t, s)); uv.push(t, j / columns);
  }
  const count = positions.length / 3;
  for (let i = 0; i < count; i++) {
    positions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2] - thickness);
    uv.push(uv[i * 2], uv[i * 2 + 1]);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    const a = i * (columns + 1) + j, b = a + columns + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1,
      a + count, a + 1 + count, b + count, b + count, a + 1 + count, b + 1 + count);
  }
  const edge = [];
  for (let i = 0; i <= rows; i++) edge.push(i * (columns + 1));
  for (let j = 1; j <= columns; j++) edge.push(rows * (columns + 1) + j);
  for (let i = rows - 1; i >= 0; i--) edge.push(i * (columns + 1) + columns);
  for (let j = columns - 1; j > 0; j--) edge.push(j);
  // Keep the lip normals separate from the two broad surfaces. Averaging
  // opposite faces through a thin edge would turn highlights inside out.
  const wall = positions.length / 3;
  for (const vertex of edge) for (const offset of [0, count]) {
    const i = vertex + offset;
    positions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    uv.push(uv[i * 2], uv[i * 2 + 1]);
  }
  for (let i = 0; i < edge.length; i++) {
    const a = wall + i * 2, b = wall + (i + 1) % edge.length * 2;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function leafGeometry(length, width) {
  return reliefSurface(28, 14, (t, s) => {
    const envelope = Math.pow(Math.sin(Math.PI * t), .75);
    const lobes = 1 + .09 * Math.sin(t * Math.PI * 12);
    const shoulder = Math.pow(1 - s * s, 1.2);
    let veins = 0;
    for (const fork of [.22, .40, .58, .74]) veins += Math.exp(-Math.pow((t - fork - Math.abs(s) * .17) / .025, 2));
    const z = .032 * envelope * shoulder + .008 * Math.pow(t, 3)
      - .004 * veins * Math.sin(Math.PI * Math.abs(s)) * envelope * shoulder;
    return [t * length, s * width * envelope * lobes, z];
  }, .009);
}

function workedMetal() {
  const pixels = new Uint8Array(256 * 128 * 4); let seed = 1873;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 189 + (seed / 4294967296 - .5) * 18 + Math.sin(x * .1 + y * .3) * 3;
    pixels.set([value, value, value, 255], (y * 256 + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, 256, 128);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

export function createNameCrestMetalwork(brass) {
  const group = new THREE.Group(); group.name = 'oval-floral-name-crest';
  // Match the desk hardware's alloy; only the surface finish varies between
  // the satin field, cast foliage, and lightly burnished rims and letter faces.
  const texture = workedMetal(), cast = brass.clone();
  cast.roughnessMap = cast.bumpMap = texture; cast.roughness = .55; cast.bumpScale = .00055;
  const satin = cast.clone(); satin.roughness = .79;
  const burnished = cast.clone(); burnished.roughness = .40;
  function mesh(geometry, material, name) {
    const object = new THREE.Mesh(geometry, material); object.name = name;
    object.castShadow = object.receiveShadow = true; group.add(object); return object;
  }
  const oval = new THREE.Shape(); oval.absellipse(0, 0, 2.40, .66, 0, Math.PI * 2, false);
  mesh(new THREE.ExtrudeGeometry(oval, { depth: .041, bevelEnabled: true, bevelSize: .012,
    bevelThickness: .010, bevelSegments: 5, curveSegments: 120 }), satin, 'solid-oval-plaque');
  mesh(ovalMolding(2.35, .61), burnished, 'continuous-oval-molding');

  const foliage = [], flowers = [];
  function add(geometry, x = 0, y = 0, z = .064, angle = 0, batch = foliage) {
    geometry.rotateZ(angle); geometry.translate(x, y, z);
    if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat; }
    const p = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 2, p.getY(i) * 2);
    batch.push(geometry);
  }
  function leaf(x, y, angle, length, width, sx, sy) {
    add(leafGeometry(length, width), sx * x, sy * y, .073,
      Math.atan2(sy * Math.sin(angle), sx * Math.cos(angle)));
  }
  function scroll(points, sx, sy, radius = .019) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z = .079]) => new THREE.Vector3(x * sx, y * sy, z)));
    const geometry = new THREE.TubeGeometry(curve, 72, radius, 10, false), p = geometry.attributes.position;
    // Tuck the tapered endpoints into the casting, avoiding blunt wire ends.
    for (let row = 0; row <= 72; row++) {
      const t = row / 72, center = curve.getPointAt(t);
      const taper = .18 + .82 * THREE.MathUtils.smoothstep(t, 0, .07) * THREE.MathUtils.smoothstep(1 - t, 0, .08);
      for (let col = 0; col <= 10; col++) {
        const i = row * 11 + col;
        p.setXYZ(i, center.x + (p.getX(i) - center.x) * taper, center.y + (p.getY(i) - center.y) * taper,
          center.z + (p.getZ(i) - center.z) * taper - radius * (1 - taper));
      }
    }
    geometry.computeVertexNormals(); add(geometry, 0, 0, 0);
  }
  function rose(x, y, radius) {
    // Overlapping cupped petals turn outward at the lip; concentric offsets
    // open a shadowed centre instead of piling ellipsoids into a rosette.
    for (const [count, inner, outer, z, lift] of [[8, .38, 1, .012, .043], [6, .16, .72, .041, .054], [5, .035, .40, .071, .052]]) {
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count + outer * 2.4;
        const petal = reliefSurface(16, 20, (t, s) => {
          const a = angle + s * Math.PI / count * 1.24 * (.48 + .52 * Math.sin(t * Math.PI / 2));
          const r = radius * (inner + (outer - inner) * t) * (1 - .09 * Math.pow(Math.abs(s), 3));
          return [Math.cos(a) * r, Math.sin(a) * r,
            z + lift * Math.sin(t * Math.PI * .85) + .016 * Math.pow(t, 5) + .012 * Math.pow(Math.abs(s), 4) * Math.sin(t * Math.PI)];
        }, .008);
        add(petal, x, y, .065, 0, flowers);
      }
    }
    const bud = new THREE.SphereGeometry(1, 20, 12); bud.scale(radius * .12, radius * .15, .026);
    add(bud, x, y, .166, .3, flowers);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    scroll([[.13, .65], [.42, .81], [.79, .82], [1.01, .67], [.88, .55], [.70, .60], [.74, .69], [.83, .66]], sx, sy);
    scroll([[.32, .64], [.92, .64], [1.48, .55], [1.92, .33], [2.12, .10]], sx, sy, .016);
    leaf(.20, .65, .49, .43, .087, sx, sy);
    leaf(.54, .70, .32, .34, .077, sx, sy);
    leaf(1.06, .61, .18, .39, .085, sx, sy);
    leaf(1.30, .56, -.53, .34, .075, sx, sy);
    leaf(1.50, .51, .26, .31, .069, sx, sy);
    leaf(1.84, .32, 1.35, .29, .074, sx, sy);
    leaf(2.05, .14, 1.03, .30, .078, sx, sy);
  }
  rose(0, .70, .185); rose(0, -.68, .137);
  for (const sx of [-1, 1]) rose(sx * 2.17, 0, .205);
  mesh(mergeGeometries(foliage), cast, 'rose-leaves-and-scrolled-stems');
  mesh(mergeGeometries(flowers), cast, 'layered-cast-rose-petals');
  [...foliage, ...flowers].forEach(geometry => geometry.dispose());

  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 10, 8), burnished, 192);
  beads.name = 'oval-pearl-fillet'; beads.castShadow = beads.receiveShadow = true;
  const outline = new THREE.EllipseCurve(0, 0, 2.29, .55), matrix = new THREE.Matrix4();
  // Arc-length spacing avoids crowded beads at the pointed ends of the oval.
  for (let i = 0; i < beads.count; i++) {
    const p = outline.getPointAt(i / beads.count);
    matrix.makeTranslation(p.x, p.y, .066); beads.setMatrixAt(i, matrix);
  }
  group.add(beads);
  return group;
}
