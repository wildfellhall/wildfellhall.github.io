import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drawerTray } from '../src/drawer-tray.js';
import { desktopOutline, sweptMolding } from '../src/furniture-profiles.js';
import { createCarvings } from '../src/ornaments.js';
import { createFrameMetalwork } from '../src/control-frame.js';
import { createNameCrestMetalwork } from '../src/name-crest.js';

test('drawer interiors form a closed shell with consistently facing surfaces', () => {
  for (const width of [4.13, 4.48]) {
    const geometry = drawerTray(width), positions = geometry.attributes.position, normals = geometry.attributes.normal;
    const edges = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), expected = new THREE.Vector3();
    for (let i = 0; i < geometry.index.count; i += 3) {
      const vertices = [0, 1, 2].map(j => geometry.index.getX(i + j));
      a.fromBufferAttribute(positions, vertices[0]); b.fromBufferAttribute(positions, vertices[1]); c.fromBufferAttribute(positions, vertices[2]);
      const face = b.sub(a).cross(c.sub(a));
      assert.ok(face.lengthSq() > 1e-16, 'No collapsed triangles at the cove or rim');
      expected.set(0, 0, 0);
      for (const vertex of vertices) expected.add(new THREE.Vector3().fromBufferAttribute(normals, vertex));
      assert.ok(face.dot(expected) > 0, 'Every face must agree with its shading normals');
      for (let j = 0; j < 3; j++) {
        const key = [vertices[j], vertices[(j + 1) % 3]].sort((x, y) => x - y).join(',');
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    assert.ok([...edges.values()].every(count => count === 2), 'No cracks or unclosed boundaries in the tray');
    geometry.dispose();
  }
});

test('the closed desktop molding has matching positions and normals at its wrap', () => {
  const profile = [[-.018, .177], [.04, .115], [-.036, -.018], [.058, -.132], [-.055, -.295], [-.145, -.35]];
  const segments = 240, geometry = sweptMolding(desktopOutline(15.18, 7.57), profile, segments);
  for (const attribute of ['position', 'normal']) for (let i = 0; i < profile.length; i++) {
    const a = new THREE.Vector3().fromBufferAttribute(geometry.attributes[attribute], i);
    const b = new THREE.Vector3().fromBufferAttribute(geometry.attributes[attribute], i + segments * profile.length);
    assert.ok(a.distanceTo(b) < 1e-6, `${attribute} must meet continuously around the perimeter`);
  }
  geometry.dispose();
});

test('all carved relief and edge beads produce finite renderable geometry', () => {
  const paint = new THREE.MeshStandardMaterial(), drawers = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const root = createCarvings(paint, paint, paint, drawers);
  root.add(...drawers);
  let meshes = 0;
  root.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    for (const attribute of ['position', 'normal']) assert.ok(object.geometry.attributes[attribute].array.every(Number.isFinite));
    object.geometry.computeBoundingSphere();
    assert.ok(Number.isFinite(object.geometry.boundingSphere.radius));
    object.geometry.dispose();
  });
  assert.ok(meshes >= 5, 'Fixed relief and all drawer fronts must remain present');
  paint.dispose();
});

test('the cast metal frame has a closed molding and finite relief surfaces', () => {
  const frame = createFrameMetalwork(), molding = frame.getObjectByName('continuous-cast-molding');
  const edges = new Map();
  for (let i = 0; i < molding.geometry.index.count; i += 3) {
    const vertices = [0, 1, 2].map(j => molding.geometry.index.getX(i + j));
    for (let j = 0; j < 3; j++) {
      const edge = [vertices[j], vertices[(j + 1) % 3]].sort((a, b) => a - b).join(',');
      edges.set(edge, (edges.get(edge) || 0) + 1);
    }
  }
  assert.ok([...edges.values()].every(count => count === 2), 'The molding must close at every corner and around its section');
  frame.traverse(object => {
    if (!object.isMesh) return;
    for (const key of ['position', 'normal']) assert.ok(object.geometry.attributes[key].array.every(Number.isFinite));
    object.geometry.dispose(); object.material.dispose();
  });
});

test('the oval name crest has a closed rim and outward-facing floral relief', () => {
  const brass = new THREE.MeshStandardMaterial({ color: '#9c7844', metalness: .84, roughness: .39 });
  const crest = createNameCrestMetalwork(brass), rim = crest.getObjectByName('continuous-oval-molding');
  const edges = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < rim.geometry.index.count; i += 3) {
    const vertices = [0, 1, 2].map(j => rim.geometry.index.getX(i + j));
    for (let j = 0; j < 3; j++) {
      const key = [vertices[j], vertices[(j + 1) % 3]].sort((x, y) => x - y).join(',');
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  assert.ok([...edges.values()].every(count => count === 2), 'The oval molding must have no open seam');
  const materials = new Set([brass]), textures = new Set();
  crest.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry, p = geometry.attributes.position, n = geometry.attributes.normal;
    assert.ok(p.array.every(Number.isFinite) && n.array.every(Number.isFinite));
    for (let i = 0; i < (geometry.index?.count ?? p.count); i += 3) {
      const vertices = [0, 1, 2].map(j => geometry.index ? geometry.index.getX(i + j) : i + j);
      a.fromBufferAttribute(p, vertices[0]); b.fromBufferAttribute(p, vertices[1]); c.fromBufferAttribute(p, vertices[2]);
      const face = b.sub(a).cross(c.sub(a)); normal.set(0, 0, 0);
      for (const vertex of vertices) normal.add(new THREE.Vector3().fromBufferAttribute(n, vertex));
      if (face.lengthSq() > 1e-16) assert.ok(face.dot(normal) > 0, `${object.name} must shade on its outward-facing surface`);
    }
    geometry.dispose(); materials.add(object.material);
  });
  for (const material of materials) {
    for (const key of ['map', 'bumpMap', 'roughnessMap', 'normalMap']) if (material[key]) textures.add(material[key]);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
});
