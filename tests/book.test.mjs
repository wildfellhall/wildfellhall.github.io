import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BookMotion, LEAF_COUNT } from '../src/book-motion.js';
import { createLeafGeometry, bendLeaf, PAGE_WIDTH, PAGE_BASE, SHEET_STEP, createPageBlock, sizePageBlock, sewnHeight, paperProfile } from '../src/book-geometry.js';
import { createSpineGeometry, updateSpineGeometry, spineSection, COVER_THICKNESS, CLOSED_HINGE, OPEN_HINGE, JOINT } from '../src/book-binding.js';

test('the book traverses every blank leaf in both directions without exceeding either end', () => {
  const book = new BookMotion();
  assert.equal(book.turn(1), false);
  book.open(); book.step(0, true); assert.equal(book.phase, 'open');
  assert.equal(book.turn(-1), false);
  for (let i = 0; i < LEAF_COUNT; i++) {
    assert.equal(book.turn(1), true); assert.equal(book.turn(1), false, 'Repeated input during a turn must not skip sheets');
    book.step(0, true); assert.equal(book.page, i + 1);
  }
  assert.equal(book.turn(1), false);
  for (let i = LEAF_COUNT; i > 0; i--) { book.turn(-1); book.step(0, true); assert.equal(book.page, i - 1); }
});

test('closing during a turn finishes the sheet and restores a closed, reusable book', () => {
  const book = new BookMotion(); book.open(); book.step(0, true);
  book.turn(1); book.step(.2, false); book.close();
  assert.equal(book.phase, 'turning'); assert.equal(book.closeQueued, true);
  book.step(0, true);
  assert.equal(book.phase, 'closed'); assert.equal(book.page, 0); assert.equal(book.openness, 0);
  book.open(); book.step(.4, false); const position = book.openness;
  book.close(); book.step(.01, false); assert.ok(book.openness < position, 'Reversing the cover must remain continuous');
  book.open(); book.step(0, true); assert.equal(book.phase, 'open');
});

test('turning paper remains attached to the sewn edge, bends above the desk, and retains its width', () => {
  const geometry = createLeafGeometry(), p = geometry.attributes.position, { rows, columns } = geometry.userData;
  for (const progress of [0, .12, .3, .5, .72, .9, 1]) {
    bendLeaf(geometry, progress, .24);
    assert.ok(p.array.every(Number.isFinite) && geometry.attributes.normal.array.every(Number.isFinite));
    for (let row = 0; row < rows; row++) {
      assert.ok(Math.abs(p.getX(row)) < 1e-7);
      assert.ok(Math.abs(p.getY(row) - .24) < 1e-6);
      let length = 0;
      for (let column = 1; column <= columns; column++) {
        const a = new THREE.Vector3().fromBufferAttribute(p, (column - 1) * rows + row);
        const b = new THREE.Vector3().fromBufferAttribute(p, column * rows + row);
        assert.ok(b.y >= PAGE_BASE, 'The curling page must stay above the desk and binding');
        length += a.distanceTo(b);
      }
      assert.ok(Math.abs(length - PAGE_WIDTH) < .012, 'The sheet bends without stretching');
    }
  }
  geometry.dispose();
});

test('the changing paper stacks remain closed volumes with no exposed seam', () => {
  const geometry = createPageBlock();
  for (const count of [1, 12, LEAF_COUNT]) for (const bow of [0, .5, 1]) {
    sizePageBlock(geometry, count, bow);
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
    assertClosed(geometry);
  }
  geometry.dispose();
});

function assertClosed(geometry) {
  const edges = new Map(), winding = new Map(), p = geometry.attributes.position;
  const position = i => [p.getX(i), p.getY(i), p.getZ(i)].map(n => n.toFixed(6)).join(',');
  for (let i = 0; i < geometry.index.count; i += 3) {
    const ids = [0, 1, 2].map(j => position(geometry.index.getX(i + j)));
    for (let j = 0; j < 3; j++) {
      const key = [ids[j], ids[(j + 1) % 3]].sort().join('|');
      edges.set(key, (edges.get(key) || 0) + 1);
      winding.set(key, (winding.get(key) || 0) + (ids[j] < ids[(j + 1) % 3] ? 1 : -1));
    }
  }
  assert.ok([...edges.values()].every(value => value === 2));
  assert.ok([...winding.values()].every(value => value === 0), 'Joined faces must agree on their outside');
}

test('resting leaves match the curved stack exactly and cut edges do not tilt the paper normals', () => {
  const stack = createPageBlock(), leaf = createLeafGeometry();
  for (const count of [1, 24, 48]) for (const bow of [0, .5, 1]) {
    sizePageBlock(stack, count, bow);
    bendLeaf(leaf, 0, sewnHeight(count, bow), bow, count * SHEET_STEP);
    const lp = leaf.attributes.position, sp = stack.attributes.position, sn = stack.attributes.normal;
    for (let i = 0; i < lp.count; i++) {
      assert.ok(new THREE.Vector3().fromBufferAttribute(lp, i).distanceTo(new THREE.Vector3().fromBufferAttribute(sp, i)) < 1e-6);
      assert.ok(sn.getY(i) > .65 && Math.abs(sn.getZ(i)) < .10, 'The top has paper normals, including its cut edge');
    }
    const profile = paperProfile(count, bow);
    assert.ok(profile[0].y <= profile.at(-1).y);
  }
  leaf.dispose(); stack.dispose();
});

test('the leather spine stays closed and follows both moving cover attachments', () => {
  const geometry = createSpineGeometry();
  for (const openness of [0, .15, .5, .85, 1]) {
    updateSpineGeometry(geometry, openness); assertClosed(geometry);
    const p = geometry.attributes.position;
    assert.ok(p.array.every(Number.isFinite) && geometry.attributes.normal.array.every(Number.isFinite));
    for (let i = 0; i < p.count; i++) assert.ok(p.getY(i) > -.004, 'The binding must not pass through the tabletop');
    const angle = openness * Math.PI, front = spineSection(0, openness), back = spineSection(1, openness);
    const expected = new THREE.Vector2(-JOINT * openness + .045 * Math.cos(angle) - COVER_THICKNESS / 2 * Math.sin(angle),
      CLOSED_HINGE + (OPEN_HINGE - CLOSED_HINGE) * openness + .045 * Math.sin(angle) + COVER_THICKNESS / 2 * Math.cos(angle));
    assert.ok(front.point.distanceTo(expected) < 1e-8);
    assert.ok(back.point.distanceTo(new THREE.Vector2(JOINT * openness + .045, OPEN_HINGE - COVER_THICKNESS / 2)) < 1e-8);
  }
  geometry.dispose();
});
