import * as THREE from 'three';
import { LEAF_COUNT } from './book-motion.js';

export const PAGE_WIDTH = 2.40, PAGE_DEPTH = 3.34, SHEET_STEP = .005, PAGE_BASE = .0825;
const COLUMNS = 64, ROWS = 24;
export const pageLift = s => .025 * Math.sin(s * Math.PI) + .006 * (1 - Math.exp(-s * 12));
export const sewnHeight = (count, bow = 1) => PAGE_BASE + count * SHEET_STEP * (1 - .56 * bow);

// Integrate fixed-length paper sections so the free leaf and the stack share
// exactly the same curved profile, including the dip into the sewn gutter.
function profileRise(s, thickness) {
  return pageLift(s) + thickness * .56 * (1 - Math.exp(-s * 12));
}
export function paperProfile(count, bow = 1) {
  const points = [], thickness = count * SHEET_STEP;
  let x = 0;
  for (let i = 0; i <= COLUMNS; i++) {
    const s = i / COLUMNS, rise = profileRise(s, thickness) * bow;
    if (i) {
      const dy = rise - profileRise((i - 1) / COLUMNS, thickness) * bow;
      x += Math.sqrt(Math.max(0, (PAGE_WIDTH / COLUMNS) ** 2 - dy ** 2));
    }
    points.push(new THREE.Vector2(x, sewnHeight(count, bow) + rise));
  }
  return points;
}

export function createLeafGeometry() {
  const geometry = new THREE.BufferGeometry(), positions = [], uv = [], indices = [];
  for (let i = 0; i <= COLUMNS; i++) for (let j = 0; j <= ROWS; j++) {
    positions.push(i / COLUMNS * PAGE_WIDTH, 0, (j / ROWS - .5) * PAGE_DEPTH);
    uv.push(i / COLUMNS, 1 - j / ROWS);
    if (i < COLUMNS && j < ROWS) {
      const a = i * (ROWS + 1) + j, b = a + ROWS + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  geometry.userData.rows = ROWS + 1; geometry.userData.columns = COLUMNS;
  return geometry;
}

export function bendLeaf(geometry, progress, rootHeight, bow = 1, thickness = 0) {
  const p = geometry.attributes.position, swing = Math.sin(progress * Math.PI);
  for (let j = 0; j <= ROWS; j++) {
    const z = (j / ROWS - .5) * PAGE_DEPTH;
    let x = 0, y = rootHeight;
    for (let i = 0; i <= COLUMNS; i++) {
      const s = i / COLUMNS;
      if (i) {
        const t = (i - .5) / COLUMNS, step = PAGE_WIDTH / COLUMNS;
        const rise = (profileRise(s, thickness) - profileRise((i - 1) / COLUMNS, thickness)) * bow;
        const restAngle = Math.asin(THREE.MathUtils.clamp(rise / step, -.99, .99));
        const angle = progress * Math.PI + swing * (.62 * Math.sin(t * Math.PI) + .20 * z / PAGE_DEPTH * t)
          + Math.cos(progress * Math.PI) * (1 - swing) * restAngle;
        x += Math.cos(angle) * step; y += Math.sin(angle) * step;
      }
      p.setXYZ(i * (ROWS + 1) + j, x, y, z + swing * .018 * Math.sin(s * Math.PI));
    }
  }
  p.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}

export function createPageBlock() {
  const p = [], uv = [], indices = [], surfaces = [];
  // Cut edges have separate vertices/normals from the paper faces, but exact
  // matching positions. A single volume replaces the old overlapping top leaf.
  function surface(columns, rows, material, point) {
    const start = p.length / 3, offset = indices.length;
    for (let i = 0; i <= columns; i++) for (let j = 0; j <= rows; j++) {
      const vertex = point(i / columns, j / rows);
      p.push(...vertex.position); uv.push(...vertex.uv); surfaces.push(vertex);
      if (i < columns && j < rows) {
        const a = start + i * (rows + 1) + j, b = a + rows + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    return { start: offset, count: indices.length - offset, materialIndex: material };
  }
  const point = (s, v, top, face, uv) => ({ position: [s * PAGE_WIDTH, 0, (v - .5) * PAGE_DEPTH], s, v, top, face, uv });
  const groups = [
    surface(COLUMNS, ROWS, 0, (s, v) => point(s, v, 1, 'top', [s, 1 - v])),
    surface(COLUMNS, ROWS, 1, (s, v) => point(s, 1 - v, 0, 'bottom', [s, 1 - v])),
    surface(COLUMNS, 1, 1, (s, t) => point(s, 0, t, 'head', [s, t])),
    surface(COLUMNS, 1, 1, (s, t) => point(s, 1, 1 - t, 'tail', [s, 1 - t])),
    surface(ROWS, 1, 1, (v, t) => point(0, v, 1 - t, 'spine', [v, 1 - t])),
    surface(ROWS, 1, 1, (v, t) => point(1, v, t, 'fore', [v, t])),
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.userData.surfaces = surfaces;
  return geometry;
}

export function sizePageBlock(geometry, count, bow = 1) {
  const p = geometry.attributes.position, uv = geometry.attributes.uv, profile = paperProfile(count, bow);
  geometry.userData.surfaces.forEach((vertex, i) => {
    const cross = profile[Math.round(vertex.s * COLUMNS)];
    const base = PAGE_BASE + pageLift(vertex.s) * bow;
    p.setXYZ(i, cross.x, THREE.MathUtils.lerp(base, cross.y, vertex.top), (vertex.v - .5) * PAGE_DEPTH);
    if (vertex.face !== 'top') uv.setY(i, vertex.top * count / LEAF_COUNT);
  });
  p.needsUpdate = uv.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}
