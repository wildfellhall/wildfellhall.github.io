import * as THREE from 'three';

export const PAGE_WIDTH = 2.30, PAGE_DEPTH = 3.28, SHEET_STEP = .005, PAGE_BASE = .0825;
const COLUMNS = 48, ROWS = 16;
export const pageLift = s => .025 * Math.sin(s * Math.PI) + .006 * (1 - Math.exp(-s * 12));

export function createLeafGeometry() {
  const geometry = new THREE.BufferGeometry();
  // Use a regular sheet grid with its sewn edge at x=0. Position and normal
  // buffers are updated as the leaf bends, so both faces catch actual light.
  const positions = [], uv = [], indices = [];
  for (let i = 0; i <= COLUMNS; i++) for (let j = 0; j <= ROWS; j++) {
    positions.push(i / COLUMNS * PAGE_WIDTH, 0, (j / ROWS - .5) * PAGE_DEPTH);
    uv.push(i / COLUMNS, 1 - j / ROWS);
    if (i < COLUMNS && j < ROWS) {
      const a = i * (ROWS + 1) + j, b = a + ROWS + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  return geometry;
}

export function bendLeaf(geometry, progress, rootHeight, bow = 1) {
  const p = geometry.attributes.position, swing = Math.sin(progress * Math.PI);
  for (let j = 0; j <= ROWS; j++) {
    const z = (j / ROWS - .5) * PAGE_DEPTH;
    let x = 0, y = rootHeight;
    for (let i = 0; i <= COLUMNS; i++) {
      const s = i / COLUMNS;
      if (i) {
        const t = (i - .5) / COLUMNS;
        const angle = progress * Math.PI + swing * (.62 * Math.sin(t * Math.PI) + .20 * z / PAGE_DEPTH * t);
        x += Math.cos(angle) * PAGE_WIDTH / COLUMNS; y += Math.sin(angle) * PAGE_WIDTH / COLUMNS;
      }
      const lift = pageLift(s) * (1 - swing) * bow;
      p.setXYZ(i * (ROWS + 1) + j, x, y + lift, z + swing * .018 * Math.sin(s * Math.PI));
    }
  }
  p.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}

export function createPageBlock() {
  const positions = [], uv = [], indices = [];
  // Cross section: lower near edge, upper near edge, upper far edge, lower
  // far edge. Every ring closes, including the spine and the fore-edge.
  for (let i = 0; i <= COLUMNS; i++) for (let corner = 0; corner < 4; corner++) {
    positions.push(i / COLUMNS * PAGE_WIDTH, 0, (corner < 2 ? -.5 : .5) * PAGE_DEPTH);
    uv.push(i / COLUMNS, corner === 1 || corner === 2 ? 1 : 0);
    if (i < COLUMNS) {
      const a = i * 4 + corner, b = i * 4 + (corner + 1) % 4;
      indices.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  indices.push(0, 2, 1, 0, 3, 2);
  const n = COLUMNS * 4; indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  return geometry;
}

export function sizePageBlock(geometry, count, bow = 1) {
  const p = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i <= COLUMNS; i++) for (let corner = 0; corner < 4; corner++) {
    const top = corner === 1 || corner === 2, vertex = i * 4 + corner;
    p.setY(vertex, PAGE_BASE + pageLift(i / COLUMNS) * bow + (top ? count * SHEET_STEP : 0));
    uv.setY(vertex, top ? count / 48 : 0);
  }
  p.needsUpdate = uv.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}
