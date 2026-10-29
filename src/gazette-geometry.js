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
        // The untied bundle holds air in its shoulder. As it opens that
        // broad bend settles into the much smaller remembered paper crease.
        const radiusSpan = .048 + .046 * fold;
        const centre = .514 + .004 * u;
        const shoulder = THREE.MathUtils.smoothstep(v, centre - radiusSpan / 2, centre + radiusSpan / 2);
        const loose = fold * (Math.PI - .065 - .024 * Math.sin(u * Math.PI)) * shoulder;
        const cockle = .014 * Math.sin(v * 13 + u * 5) + .006 * Math.sin(v * 31 - u * 8);
        const edgeCurl = .17 * Math.exp(-v * 42) * Math.sin(u * 5 + 1)
          - .20 * Math.exp(-(1 - v) * 37) * Math.sin(u * 4 + .4);
        const creaseMemory = .075 * Math.exp(-(((v - .516) / .03) ** 2)) * Math.sin((v - .516) * 64) * openness;
        const cornerCurl = -fold * .065 * THREE.MathUtils.smoothstep(v, .72, 1)
          * (u ** 5 + .55 * (1 - u) ** 6);
        const angle = loose + cockle + edgeCurl + creaseMemory + cornerCurl;
        z += Math.cos(angle) * step; y += Math.sin(angle) * step;
      }
      // Small asymmetric deckle and a barely rippled free edge. The paper's
      // outline is a cut edge, not a mechanically perfect rectangle.
      const edge = Math.abs(u - .5) * 2;
      const dx = edge ** 12 * (.003 * Math.sin(t * 89 + col) + .0018 * Math.sin(t * 237));
      p.setXYZ(row * (COLS + 1) + col, x + dx, y + .004 * Math.sin(u * 9), z);
    }
  }
  // Keep all points above the timber while allowing the loose folded flap
  // to lift naturally. Offset is common to the whole continuous sheet.
  let min = Infinity;
  for (let i = 0; i < p.count; i++) min = Math.min(min, p.getY(i));
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - min + .008);
  p.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

// Slips are deliberately unequal, like gathered sheets after a tie is
// removed. They expose paper on both sides instead of making a regular fan.
const RESTING_SLIPS = [[0, 0], [-.19, -.13], [.14, -.30], [-.09, -.48]];

// Nest continuous sheets around the shoulder, with thin stock and varying
// air gaps. The broad sheet faces stay close; the fold and free edges relax.
export function offsetGazetteLayer(target, source, layer, openness) {
  const p = target.attributes.position, base = source.attributes.position, normals = source.attributes.normal;
  const resting = (1 - openness) ** 2, point = new THREE.Vector3(), normal = new THREE.Vector3();
  const slip = new THREE.Vector3(), [restX, restZ] = RESTING_SLIPS[layer % RESTING_SLIPS.length];
  for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(base, i); normal.fromBufferAttribute(normals, i);
    const u = source.attributes.uv.getX(i), v = source.attributes.uv.getY(i);
    const freeEdge = THREE.MathUtils.smoothstep(Math.abs(v - .48), .10, .32);
    const shoulder = Math.exp(-(((v - .484) / .095) ** 2));
    const side = Math.abs(u * 2 - 1) ** 5;
    let curl = 0;
    for (let gap = 1; gap <= layer; gap++) curl += .35 + .65 * Math.sin(u * 3 + gap * .7) ** 2;
    const separation = .0065 * layer + resting * (layer * (.027 * shoulder + .014 * side)
      + (.026 * curl + .021 * layer * side) * freeEdge);
    point.addScaledVector(normal, separation);
    // Slide in the sheet's tangent plane. A world-space translation would
    // cut through the next sheet on the slope approaching the folded edge.
    slip.set((layer * .012 + resting * restX) * freeEdge, 0,
      (layer * .018 + resting * restZ) * freeEdge);
    slip.addScaledVector(normal, -slip.dot(normal)); point.add(slip);
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
  return new THREE.TubeGeometry(curve, boundary.length, .0009, 4, false);
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
