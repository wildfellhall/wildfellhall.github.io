import * as THREE from 'three';
import { PAGE_BASE, SHEET_STEP } from './book-geometry.js';
import { LEAF_COUNT } from './book-motion.js';

export const COVER_WIDTH = 2.48, COVER_DEPTH = 3.50, COVER_THICKNESS = .075;
export const CLOSED_HINGE = PAGE_BASE + LEAF_COUNT * SHEET_STEP + COVER_THICKNESS / 2 + .0015;
export const OPEN_HINGE = .040, JOINT = .06;
export const BAND_POSITIONS = [-1.28, -.67, 0, .67, 1.28];
const SECTIONS = 48, LENGTH_SEGMENTS = 160;

// A leather wrap joins the outside faces of both boards with matching
// tangents. The wrap unfolds with the front board instead of being squashed.
export function spineSection(t, openness) {
  const angle = openness * Math.PI, c = Math.cos(angle), s = Math.sin(angle);
  const frontY = THREE.MathUtils.lerp(CLOSED_HINGE, OPEN_HINGE, openness);
  const p0 = new THREE.Vector2(-JOINT * openness + .045 * c - COVER_THICKNESS / 2 * s,
    frontY + .045 * s + COVER_THICKNESS / 2 * c);
  const p3 = new THREE.Vector2(JOINT * openness + .045, OPEN_HINGE - COVER_THICKNESS / 2);
  const reach = .28 * (1 - openness * .5);
  const p1 = p0.clone().add(new THREE.Vector2(-c, -s).multiplyScalar(reach));
  const p2 = p3.clone().add(new THREE.Vector2(-reach, 0));
  const curve = new THREE.CubicBezierCurve(p0, p1, p2, p3), point = curve.getPoint(t), tangent = curve.getTangent(t);
  return { point, normal: new THREE.Vector2(tangent.y, -tangent.x) };
}

function bandRise(t, z, openness) {
  let height = 0;
  for (const band of BAND_POSITIONS) height += Math.exp(-(((z - band) / .025) ** 2)) * .014;
  return height * Math.sin(Math.PI * t) * (1 - openness);
}

export function createSpineGeometry() {
  const p = [], uv = [], indices = [], stride = LENGTH_SEGMENTS + 1, layer = (SECTIONS + 1) * stride;
  for (let side = 0; side < 2; side++) for (let i = 0; i <= SECTIONS; i++) for (let j = 0; j <= LENGTH_SEGMENTS; j++) {
    p.push(0, 0, 0); uv.push(.018 - i / SECTIONS * .28, 1 - j / LENGTH_SEGMENTS);
    if (i < SECTIONS && j < LENGTH_SEGMENTS) {
      const a = side * layer + i * stride + j, b = a + stride;
      if (!side) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // Close the head, tail and both board attachments around the thin wrap.
  const edge = (a, b) => indices.push(a, a + layer, b, b, a + layer, b + layer);
  for (let i = 0; i < SECTIONS; i++) {
    edge(i * stride, (i + 1) * stride);
    edge((i + 1) * stride + LENGTH_SEGMENTS, i * stride + LENGTH_SEGMENTS);
  }
  for (let j = 0; j < LENGTH_SEGMENTS; j++) {
    edge(j + 1, j); edge(SECTIONS * stride + j, SECTIONS * stride + j + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  updateSpineGeometry(geometry, 0); return geometry;
}

export function updateSpineGeometry(geometry, openness) {
  const p = geometry.attributes.position; let vertex = 0;
  const sections = Array.from({ length: SECTIONS + 1 }, (_, i) => spineSection(i / SECTIONS, openness));
  for (let side = 0; side < 2; side++) for (let i = 0; i <= SECTIONS; i++) for (let j = 0; j <= LENGTH_SEGMENTS; j++) {
    const { point, normal } = sections[i], z = (j / LENGTH_SEGMENTS - .5) * COVER_DEPTH;
    const height = side ? -.006 : bandRise(i / SECTIONS, z, openness);
    p.setXYZ(vertex++, point.x + normal.x * height, point.y + normal.y * height, z);
  }
  p.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const normals = geometry.attributes.normal;
  // The cut underside of the wrap should not tilt the outer face's normals
  // at the join with the boards' flat leather faces.
  for (const i of [0, SECTIONS]) for (let j = 1; j < LENGTH_SEGMENTS; j++) {
    const normal = sections[i].normal;
    normals.setXYZ(i * (LENGTH_SEGMENTS + 1) + j, normal.x, normal.y, 0);
  }
  normals.needsUpdate = true;
}

export function createSpineFillet() {
  return new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), SECTIONS, .0022, 6, false);
}
export function updateSpineFillet(geometry, z, openness) {
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  for (let i = 0; i <= SECTIONS; i++) {
    const t = i / SECTIONS, { point, normal } = spineSection(t, openness);
    for (let j = 0; j <= 6; j++) {
      const a = j / 6 * Math.PI * 2, radius = .0022;
      const height = bandRise(t, z, openness) + .0005 + Math.cos(a) * radius;
      p.setXYZ(i * 7 + j, point.x + normal.x * height, point.y + normal.y * height, z + Math.sin(a) * radius);
      n.setXYZ(i * 7 + j, normal.x * Math.cos(a), normal.y * Math.cos(a), Math.sin(a));
    }
  }
  p.needsUpdate = n.needsUpdate = true; geometry.computeBoundingSphere();
}
