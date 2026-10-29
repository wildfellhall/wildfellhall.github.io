import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBookMaterials } from './book-materials.js';
import { createBookPages } from './book-pages.js';
import { pageFaces } from './book-text.js';
import { BookMotion, LEAF_COUNT } from './book-motion.js';
import { PAGE_WIDTH, PAGE_DEPTH, PAGE_BASE, SHEET_STEP, createLeafGeometry, bendLeaf, createPageBlock, sizePageBlock, sewnHeight, paperProfile } from './book-geometry.js';

import { COVER_WIDTH, COVER_DEPTH, COVER_THICKNESS, CLOSED_HINGE, OPEN_HINGE, JOINT, BAND_POSITIONS, createSpineGeometry, updateSpineGeometry, createSpineFillet, updateSpineFillet } from './book-binding.js';

export async function createBook(surfaceY, source = '', maxTextureSize = 4096) {
  const materials = createBookMaterials(), printing = await createBookPages(materials.paper, source, maxTextureSize);
  const motion = new BookMotion(printing.leafCount);
  // More written pages divide the same slim physical text block into finer
  // leaves, preserving the established cover, spine and desk composition.
  const physicalCount = count => count * LEAF_COUNT / motion.leafCount;
  const group = new THREE.Group(); group.name = 'tenant-of-wildfell-hall';
  group.position.set(4.25, surfaceY + .004, -1.55); group.rotation.y = -.065;
  group.scale.setScalar(.76);
  function mesh(geometry, material, parent, name, action) {
    const object = new THREE.Mesh(geometry, material); object.name = name;
    object.castShadow = object.receiveShadow = true;
    if (action) { object.userData.bookPick = true; object.userData.bookAction = action; }
    parent.add(object); return object;
  }
  function board(parent, name, action) {
    const geometry = new RoundedBoxGeometry(COVER_WIDTH, COVER_THICKNESS, COVER_DEPTH, 4, .024);
    const p = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / COVER_WIDTH + .5, .5 - p.getZ(i) / COVER_DEPTH);
    const object = mesh(geometry, materials.leather, parent, name, action); object.position.x = COVER_WIDTH / 2;
    return object;
  }
  const back = new THREE.Group(); back.position.y = OPEN_HINGE; group.add(back);
  board(back, 'leather-back-board', 'next');
  const front = new THREE.Group(); group.add(front);
  board(front, 'hinged-leather-front-board', 'toggle');
  for (const [parent, sign] of [[front, -1], [back, 1]]) {
    const lining = mesh(new THREE.PlaneGeometry(COVER_WIDTH - .15, COVER_DEPTH - .15), printing.get(sign < 0 ? -1 : -2), parent, 'ornamented-aged-pastedown');
    lining.rotation.x = -sign * Math.PI / 2;
    lining.position.set(COVER_WIDTH / 2, sign * (COVER_THICKNESS / 2 + .001), 0);
    lining.castShadow = false;
  }
  front.add(coverTooling(materials.gold));
  const title = await titleGeometry();
  mesh(title, materials.gold, front, 'gold-leaf-title').position.set(COVER_WIDTH / 2 + .035, COVER_THICKNESS / 2 + .001, -.03);

  const spine = mesh(createSpineGeometry(), materials.leather, group, 'continuous-leather-spine', 'toggle');
  const fillets = [];
  for (const z of BAND_POSITIONS) for (const shift of [-.036, .036]) {
    const fillet = mesh(createSpineFillet(), materials.gold, group, 'gilt-spine-fillet');
    fillets.push({ mesh: fillet, z: z + shift });
  }
  const hingePaper = materials.paper[2].clone();
  // A paper-thin lap needs a depth offset to keep multisample coverage from
  // exposing isolated pixels of the sheet underneath the overlap.
  hingePaper.polygonOffset = true; hingePaper.polygonOffsetFactor = -2; hingePaper.polygonOffsetUnits = -2;
  const gutter = mesh(new THREE.PlaneGeometry(1, 1, 24, 24), hingePaper, group, 'folded-endpaper-hinge', 'previous');
  // The boards and paper volumes supply contact shadows. The thin lining
  // must not cast duplicate, speckled shadows along its shared boundaries.
  gutter.castShadow = false;
  const silks = ['#c5b48e', '#8c4b3e'].map(color => new THREE.MeshStandardMaterial({ color, roughness: .88 }));
  const threads = [], threadGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  for (const z of [-PAGE_DEPTH / 2 - .005, PAGE_DEPTH / 2 + .005]) for (let i = 0; i < 18; i++) {
    const thread = mesh(threadGeometry, silks[i % 2], group, 'sewn-headband');
    thread.castShadow = false; threads.push({ thread, z, i });
  }
  const left = new THREE.Group(); group.add(left);
  const leftBlock = mesh(createPageBlock(), [materials.paper[1], materials.edges], left, 'left-paper-block', 'previous'); leftBlock.scale.x = -1;
  const rightBlock = mesh(createPageBlock(), [materials.paper[0], materials.edges], group, 'right-paper-block', 'next');
  const recto = materials.paper[0].clone(), verso = materials.paper[0].clone();
  recto.side = THREE.FrontSide; recto.shadowSide = THREE.DoubleSide; verso.side = THREE.BackSide;
  const turning = mesh(createLeafGeometry(), recto, group, 'curling-paper-leaf', 'busy');
  const reverse = mesh(turning.geometry, verso, turning, 'curling-paper-verso', 'busy'); reverse.castShadow = false;
  turning.visible = false;
  let lastLeft = -1, lastRight = -1, lastOpen = -1;
  function updateGeometry() {
    const openness = motion.openness;
    front.rotation.z = openness * Math.PI;
    front.position.y = THREE.MathUtils.lerp(CLOSED_HINGE, OPEN_HINGE, openness);
    front.position.x = -JOINT * openness; back.position.x = JOINT * openness;
    if (openness !== lastOpen) {
      updateSpineGeometry(spine.geometry, openness);
      for (const fillet of fillets) updateSpineFillet(fillet.mesh.geometry, fillet.z, openness);
    }
    const turn = motion.phase === 'turning';
    const faces = pageFaces(motion.page, turn, motion.direction);
    const leftCount = motion.page - (turn && motion.direction < 0 ? 1 : 0);
    const rightCount = motion.leafCount - motion.page - (turn && motion.direction > 0 ? 1 : 0);
    leftBlock.visible = leftCount > 0;
    rightBlock.visible = rightCount > 0;
    if (leftCount !== lastLeft || openness !== lastOpen) {
      sizePageBlock(leftBlock.geometry, physicalCount(leftCount), openness);
      lastLeft = leftCount;
    }
    if (rightCount !== lastRight || openness !== lastOpen) {
      sizePageBlock(rightBlock.geometry, physicalCount(rightCount), openness);
      lastRight = rightCount;
    }
    leftBlock.material[0] = printing.get(faces.left);
    rightBlock.material[0] = printing.get(faces.right);
    lastOpen = openness;
    // A gathered left-hand stack returns with the board when closing. It
    // settles above the remaining right-hand pages, then resets under cover.
    left.position.x = -.045 * openness; rightBlock.position.x = .045 * openness;
    left.rotation.z = (openness - 1) * Math.PI;
    left.position.y = (1 - openness) * (2 * PAGE_BASE + LEAF_COUNT * SHEET_STEP);
    turning.visible = turn;
    if (turn) {
      const t = motion.turnProgress, eased = t * t * (3 - 2 * t);
      const p = motion.direction > 0 ? eased : 1 - eased;
      const count = physicalCount(THREE.MathUtils.lerp(motion.leafCount - motion.index, motion.index + 1, p));
      turning.position.x = THREE.MathUtils.lerp(.045, -.045, p);
      bendLeaf(turning.geometry, p, sewnHeight(count) + .0007, 1, count * SHEET_STEP);
      for (const [target, index] of [[recto, faces.front], [verso, faces.back]]) {
        const printed = printing.get(index);
        // Printed stock uses its ink-compressed height field. Retaining the
        // blank stock's normal map would override that field during a turn.
        if (Boolean(target.normalMap) !== Boolean(printed.normalMap)) target.needsUpdate = true;
        target.map = printed.map; target.bumpMap = printed.bumpMap; target.normalMap = printed.normalMap;
      }
    }
    printing.prune(new Set([-1, -2, faces.left, faces.right, faces.front, faces.back]));
    // A real paper fold connects the pastedowns and the sewn page roots.
    front.updateMatrix(); left.updateMatrix(); back.updateMatrix();
    const rootAt = (count, side) => count > 0
      ? new THREE.Vector3(0, sewnHeight(physicalCount(count), openness), 0).applyMatrix4(side < 0 ? left.matrix : rightBlock.matrix)
      : new THREE.Vector3(.075, (side < 0 ? -1 : 1) * (COVER_THICKNESS / 2 + .001), 0).applyMatrix4(side < 0 ? front.matrix : back.matrix);
    rightBlock.updateMatrix();
    const a = rootAt(leftCount, -1), b = rootAt(rightCount, 1);
    const slope = count => { const p = paperProfile(physicalCount(count), openness); return (p[1].y - p[0].y) / p[1].x; };
    const m0 = leftCount ? -slope(leftCount) : 0, m1 = rightCount ? slope(rightCount) : 0;
    // The pasted paper hinge laps very slightly over the gathered sheets.
    // This seals the cut faces and avoids a subpixel crack at their boundary.
    const lap = .016 * openness;
    function foldPoint(t) {
      const width = b.x - a.x, x = THREE.MathUtils.lerp(a.x - lap, b.x + lap, t), offset = SHEET_STEP * openness;
      // Keep the lapped ends on the sheets. Start the concave fold only in
      // the open gutter, so it cannot cut back through a page at the seam.
      if (width > 0 && x < a.x) return new THREE.Vector3(x, a.y + m0 * (x - a.x) + offset, 0);
      if (width > 0 && x > b.x) return new THREE.Vector3(x, b.y + m1 * (x - b.x) + offset, 0);
      const u = width > 0 ? (x - a.x) / width : t, u2 = u * u, u3 = u2 * u;
      return new THREE.Vector3(x,
        (2 * u3 - 3 * u2 + 1) * a.y + (u3 - 2 * u2 + u) * m0 * width
        + (-2 * u3 + 3 * u2) * b.y + (u3 - u2) * m1 * width
        - .010 * Math.sin(Math.PI * u) ** 2 * openness + offset, 0);
    }
    const gp = gutter.geometry.attributes.position, guv = gutter.geometry.attributes.uv;
    for (let j = 0; j <= 24; j++) for (let i = 0; i <= 24; i++) {
      // Put vertices exactly on both sewn roots. A triangle spanning a root
      // would chord across the concave fold and intersect the adjoining sheet.
      const width = b.x - a.x;
      const t = width > 0 && i > 0 && i < 24 ? (lap + width * (i - 1) / 22) / (width + 2 * lap) : i / 24;
      const p = foldPoint(t), vertex = j * 25 + i;
      gp.setXYZ(vertex, p.x, p.y, (j / 24 - .5) * PAGE_DEPTH);
      guv.setXY(vertex, .035 * Math.sin(Math.PI * t), 1 - j / 24);
    }
    gp.needsUpdate = guv.needsUpdate = true; gutter.geometry.computeVertexNormals(); gutter.geometry.computeBoundingSphere();
    gutter.visible = openness > .08;
    const threadPoint = (t, z) => {
      const closed = new THREE.Vector3(.012 + Math.sin(t * Math.PI) * .012, PAGE_BASE + t * LEAF_COUNT * SHEET_STEP, z);
      const open = foldPoint(t); open.z = z; open.y += .002;
      return closed.lerp(open, openness);
    };
    for (const { thread, z, i } of threads) {
      const start = threadPoint(i / 18, z), end = threadPoint((i + 1) / 18, z), direction = end.clone().sub(start);
      thread.position.copy(start).add(end).multiplyScalar(.5);
      thread.scale.set(.006, Math.max(.001, direction.length()) * .98, .006);
      thread.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }
    group.updateMatrixWorld(true);
  }
  updateGeometry();
  return {
    group, motion, pages: printing.pages,
    width: (COVER_WIDTH + JOINT) * 2 * group.scale.x, depth: COVER_DEPTH * group.scale.z,
    place(viewWidth, portrait) {
      // Keep the corner object within the cropped writing surface on phones.
      group.position.x = portrait ? .15 : Math.min(4.25, Math.max(.15, viewWidth / 2 - COVER_WIDTH * group.scale.x - .35));
      group.position.z = portrait ? .65 + 1.4 * motion.openness : -1.55;
      group.updateMatrixWorld(true);
    },
    activate(action) {
      if (action === 'toggle') return motion.opened ? motion.close() : motion.open();
      if (action === 'close') return motion.close();
      if (action === 'next') return motion.phase === 'closed' ? motion.open() : motion.turn(1);
      if (action === 'previous') return motion.page === 0 ? motion.close() : motion.turn(-1);
      return false;
    },
    animate(delta, reducedMotion) {
      const result = motion.step(delta, reducedMotion); if (result.changed) updateGeometry(); return result;
    },
    anchor(action) {
      const x = action === 'previous' ? -PAGE_WIDTH * .6 : action === 'next' ? PAGE_WIDTH * .6 : COVER_WIDTH / 2;
      return group.localToWorld(new THREE.Vector3(x, PAGE_BASE + .30, action === 'toggle' ? 0 : .8));
    },
  };
}

function coverTooling(gold) {
  const group = new THREE.Group(); group.name = 'gilt-fillet-and-corner-tools';
  const pieces = [];
  function stroke(points, radius = .004) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, COVER_THICKNESS / 2 + .001, z)));
    pieces.push(new THREE.TubeGeometry(curve, Math.max(24, points.length * 12), radius, 6, false));
  }
  for (const inset of [.16, .20]) {
    const w = COVER_WIDTH - inset, d = COVER_DEPTH / 2 - inset;
    const curve = new THREE.CurvePath();
    const corners = [[inset, -d], [w, -d], [w, d], [inset, d], [inset, -d]];
    for (let i = 1; i < corners.length; i++) curve.add(new THREE.LineCurve3(
      new THREE.Vector3(corners[i - 1][0], COVER_THICKNESS / 2 + .001, corners[i - 1][1]),
      new THREE.Vector3(corners[i][0], COVER_THICKNESS / 2 + .001, corners[i][1])));
    pieces.push(new THREE.TubeGeometry(curve, 240, .0035, 6, false));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx < 0 ? .28 : COVER_WIDTH - .28, z = sz * (COVER_DEPTH / 2 - .28);
    const local = points => points.map(([u, v]) => [x - sx * u, z - sz * v]);
    stroke(local([[0, .43], [.03, .22], [.17, .13], [.29, .21], [.22, .32], [.13, .27], [.16, .20]]));
    stroke(local([[0, .08], [.10, .05], [.20, .10], [.13, .17], [.07, .13]]));
    for (const [u, v, angle] of [[.02, .36, -.4], [.07, .19, .7], [.26, .14, 1.2]]) {
      const leaf = new THREE.SphereGeometry(1, 12, 8); leaf.scale(.017, .002, .044); leaf.rotateY(angle * sx * sz);
      leaf.translate(x - sx * u, COVER_THICKNESS / 2 + .003, z - sz * v); pieces.push(leaf);
    }
  }
  for (const z of [-.91, .98]) {
    stroke([[.90, z], [1.10, z - .025], [1.24, z], [1.38, z - .025], [1.58, z]]);
    const dot = new THREE.SphereGeometry(.018, 12, 8); dot.scale(1, .15, 1); dot.translate(COVER_WIDTH / 2, COVER_THICKNESS / 2 + .003, z + .065); pieces.push(dot);
  }
  const mesh = new THREE.Mesh(mergeGeometries(pieces), gold); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  pieces.forEach(piece => piece.dispose()); return group;
}

async function titleGeometry() {
  const svg = await new SVGLoader().loadAsync(`${import.meta.env.BASE_URL}ornaments/tenant-title.svg?v=book-1`);
  const geometry = new THREE.ExtrudeGeometry(svg.paths.flatMap(path => SVGLoader.createShapes(path)), {
    depth: .25, bevelEnabled: true, bevelThickness: .08, bevelSize: .10, bevelSegments: 3, curveSegments: 10,
  });
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, 0); geometry.scale(.0094, -.0094, .0094);
  for (const attribute of Object.values(geometry.attributes)) for (let i = 0; i < attribute.count; i += 3) {
    for (let c = 0; c < attribute.itemSize; c++) {
      const a = (i + 1) * attribute.itemSize + c, b = (i + 2) * attribute.itemSize + c;
      [attribute.array[a], attribute.array[b]] = [attribute.array[b], attribute.array[a]];
    }
  }
  geometry.computeVertexNormals(); geometry.rotateX(-Math.PI / 2); return geometry;
}
