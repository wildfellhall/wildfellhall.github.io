import * as THREE from 'three';

export const GAZETTE_WIDTH = 4.25, GAZETTE_DEPTH = 5.8;
const COLS = 64, ROWS = 100;

export function createGazetteGeometry() {
  const geometry = new THREE.BufferGeometry(), positions = [], uvs = [], indices = [];
  for (let row = 0; row <= ROWS; row++) for (let col = 0; col <= COLS; col++) {
    positions.push(0, 0, 0); uvs.push(col / COLS, 1 - row / ROWS);
    if (row < ROWS && col < COLS) {
      const i = row * (COLS + 1) + col;
      indices.push(i, i + COLS + 1, i + 1, i + 1, i + COLS + 1, i + COLS + 2);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  bendGazette(geometry, 0); return geometry;
}

// One continuous sheet, integrated along its length. The fold has a rounded
// shoulder and a relaxed angle, never a zero-radius hinge or stacked planes.
// Every longitudinal segment keeps its length throughout the unfolding.
export function bendGazette(geometry, openness) {
  const p = geometry.attributes.position, fold = 1 - openness, step = GAZETTE_DEPTH / ROWS;
  for (let col = 0; col <= COLS; col++) {
    const u = col / COLS, x = (u - .5) * GAZETTE_WIDTH;
    let z = -GAZETTE_DEPTH / 2, y = 0;
    for (let row = 0; row <= ROWS; row++) {
      const t = row / ROWS;
      if (row) {
        const v = (row - .5) / ROWS;
        const shoulder = THREE.MathUtils.smoothstep(v, .488 + .008 * u, .55 + .008 * u);
        const loose = fold * (Math.PI - .06 - .025 * Math.sin(u * Math.PI)) * shoulder;
        const cockle = .055 * Math.sin(v * 17 + u * 8) + .025 * Math.sin(v * 34 - u * 11);
        const edgeCurl = .40 * Math.exp(-v * 35) * Math.sin(u * 5 + 1)
          - .42 * Math.exp(-(1 - v) * 28) * Math.sin(u * 4 + .4);
        const creaseMemory = .18 * Math.exp(-(((v - .52) / .045) ** 2)) * Math.sin((v - .52) * 52) * openness;
        const angle = loose + cockle + edgeCurl + creaseMemory;
        z += Math.cos(angle) * step; y += Math.sin(angle) * step;
      }
      // Small asymmetric deckle and a barely rippled free edge. The paper's
      // outline is a cut edge, not a mechanically perfect rectangle.
      const edge = Math.abs(u - .5) * 2;
      const dx = edge ** 12 * (.003 * Math.sin(t * 89 + col) + .0018 * Math.sin(t * 237));
      p.setXYZ(row * (COLS + 1) + col, x + dx, y + .012 * Math.sin(u * 9), z);
    }
  }
  // Keep all points above the timber while allowing the loose folded flap
  // to lift naturally. Offset is common to the whole continuous sheet.
  let min = Infinity;
  for (let i = 0; i < p.count; i++) min = Math.min(min, p.getY(i));
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - min + .022);
  p.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

// A nested bundle follows the same rounded fold at a measured distance along
// its normal. Translating flat sheets vertically would make them intersect at
// the shoulder. Tiny staggered cut edges remain visible when unfolded.
export function offsetGazetteLayer(target, source, layer, openness) {
  const p = target.attributes.position, base = source.attributes.position, normals = source.attributes.normal;
  const separation = .017 * layer, point = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(base, i); normal.fromBufferAttribute(normals, i);
    point.addScaledVector(normal, separation);
    const u = source.attributes.uv.getX(i), v = source.attributes.uv.getY(i);
    // Let the free cut edges fan out, but keep the gathered shoulder aligned.
    // Sliding whole sheets along z would make adjacent folds cross each other.
    const freeEdge = THREE.MathUtils.smoothstep(Math.abs(v - .48), .10, .32);
    point.x += layer * .032 * (.35 + .65 * freeEdge);
    point.z += layer * .054 * freeEdge;
    // The cut corners relax independently without separating the fold.
    point.y += layer * .0012 * Math.sin(u * 8 + v * 6) * openness;
    p.setXYZ(i, point.x, point.y, point.z);
  }
  p.needsUpdate = true; target.computeVertexNormals(); target.computeBoundingBox(); target.computeBoundingSphere();
}

export function createGazetteEdge(geometry) {
  const p = geometry.attributes.position, boundary = [], cols = COLS + 1, rows = ROWS + 1;
  for (let x = 0; x < cols; x++) boundary.push(x);
  for (let y = 1; y < rows; y++) boundary.push(y * cols + cols - 1);
  for (let x = cols - 2; x >= 0; x--) boundary.push((rows - 1) * cols + x);
  for (let y = rows - 2; y > 0; y--) boundary.push(y * cols);
  boundary.push(0);
  const curve = new THREE.CatmullRomCurve3(boundary.map(i => new THREE.Vector3().fromBufferAttribute(p, i)));
  return new THREE.TubeGeometry(curve, boundary.length, .0022, 4, false);
}

export function createLooseTwine() {
  const group = new THREE.Group(); group.name = 'untied-flax-twine';
  const points = [[-.75, .03, .52], [-.38, .025, .45], [-.30, .03, .07], [-.57, .03, -.28],
    [-.16, .025, -.52], [.39, .035, -.42], [.62, .04, -.04], [.39, .045, .38],
    [-.13, .065, .26], [-.32, .06, -.08], [.07, .03, -.28], [.47, .026, .05], [.77, .026, .22]];
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'centripetal');
  const frames = curve.computeFrenetFrames(500, false);
  const material = new THREE.MeshStandardMaterial({ color: '#9f957f', roughness: 1 });
  for (let strand = 0; strand < 3; strand++) {
    const path = [];
    for (let i = 0; i <= 500; i++) {
      const t = i / 500, angle = t * 110 * Math.PI + strand * Math.PI * 2 / 3;
      path.push(curve.getPointAt(t).addScaledVector(frames.normals[i], Math.cos(angle) * .012)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * .012));
    }
    const thread = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 1100, .009, 5, false), material);
    thread.castShadow = thread.receiveShadow = true; group.add(thread);
  }
  const fine = new THREE.MeshStandardMaterial({ color: '#c4bba7', roughness: 1 });
  for (let end = 0; end < 2; end++) for (let fibre = 0; fibre < 9; fibre++) {
    const root = curve.getPoint(end), tangent = curve.getTangent(end).multiplyScalar(end ? 1 : -1);
    const tip = root.clone().addScaledVector(tangent, .08 + fibre * .006);
    tip.x += Math.sin(fibre * 4) * .037; tip.z += Math.cos(fibre * 5) * .035; tip.y = .013 + fibre * .001;
    const mid = root.clone().lerp(tip, .55); mid.y += .012;
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([root, mid, tip]), 10, .0017, 4, false), fine));
  }
  return group;
}
