import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drawerTray } from '../src/drawer-tray.js';
import { desktopOutline, sweptMolding } from '../src/furniture-profiles.js';
import { createCarvings } from '../src/ornaments.js';

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
