import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBookMaterials } from './book-materials.js';
import { BookMotion, LEAF_COUNT } from './book-motion.js';
import { PAGE_WIDTH, PAGE_DEPTH, PAGE_BASE, SHEET_STEP, createLeafGeometry, bendLeaf, createPageBlock, sizePageBlock } from './book-geometry.js';

const COVER_WIDTH = 2.48, COVER_DEPTH = 3.50, COVER_THICKNESS = .075;
const CLOSED_HINGE = .368, OPEN_HINGE = .040;

export async function createBook(surfaceY) {
  const materials = createBookMaterials(), motion = new BookMotion();
  const group = new THREE.Group(); group.name = 'tenant-of-wildfell-hall';
  group.position.set(0, surfaceY + .004, .40); group.rotation.y = -.065;
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
    const lining = mesh(new THREE.PlaneGeometry(COVER_WIDTH - .15, COVER_DEPTH - .15), materials.paper[2], parent, 'blank-aged-pastedown');
    lining.rotation.x = -sign * Math.PI / 2;
    lining.position.set(COVER_WIDTH / 2, sign * (COVER_THICKNESS / 2 + .001), 0);
  }
  front.add(coverTooling(materials.gold));
  const title = await titleGeometry();
  mesh(title, materials.gold, front, 'gold-leaf-title').position.set(COVER_WIDTH / 2 + .035, COVER_THICKNESS / 2 + .001, -.03);

  // Rounded leather spine, with five sewn raised bands. Its crown compresses
  // as the board opens while the joints remain attached to the binding.
  const spine = mesh(spineGeometry(), materials.leather, group, 'rounded-morocco-spine', 'toggle');
  const bands = new THREE.Group(); group.add(bands);
  for (const z of [-1.28, -.67, 0, .67, 1.28]) {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const a = i / 24 * Math.PI;
      points.push(new THREE.Vector3(-.018 - Math.sin(a) * .125, .204 + Math.cos(a) * .164, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    mesh(new THREE.TubeGeometry(curve, 32, .018, 10, false), materials.leather, bands, 'raised-sewing-band');
    for (const shift of [-.033, .033]) {
      const fillet = mesh(new THREE.TubeGeometry(curve, 32, .0035, 6, false), materials.gold, bands, 'gilt-spine-fillet');
      fillet.position.z = shift;
    }
  }
  const silks = ['#c5b48e', '#8c4b3e'].map(color => new THREE.MeshStandardMaterial({ color, roughness: .82 }));
  for (const z of [-PAGE_DEPTH / 2, PAGE_DEPTH / 2]) {
    const headband = new THREE.Group(); group.add(headband);
    for (let i = 0; i < 18; i++) {
      const bead = mesh(new THREE.SphereGeometry(.014, 8, 6), silks[i % 2], headband, 'sewn-headband');
      bead.position.set(.018, PAGE_BASE + .014 + i * .0125, z); bead.scale.set(.8, .60, 1);
    }
  }
  const left = new THREE.Group(); group.add(left);
  const leftBlock = mesh(createPageBlock(), materials.edges, left, 'left-paper-block', 'previous'); leftBlock.scale.x = -1;
  const rightBlock = mesh(createPageBlock(), materials.edges, group, 'right-paper-block', 'next');
  const leftPage = mesh(createLeafGeometry(), materials.paper[1], left, 'blank-left-page', 'previous');
  const rightPage = mesh(createLeafGeometry(), materials.paper[0], group, 'blank-right-page', 'next');
  // The stack casts the resting sheets' outline; only the free turning leaf
  // needs a separate shadow, avoiding doubled shadows at a paper-thin offset.
  leftPage.castShadow = rightPage.castShadow = false;
  const turning = mesh(createLeafGeometry(), materials.paper[0], group, 'curling-paper-leaf', 'busy');
  turning.visible = false;
  let lastLeft = -1, lastRight = -1, lastOpen = -1;
  function updateGeometry() {
    const openness = motion.openness;
    front.rotation.z = openness * Math.PI;
    front.position.y = THREE.MathUtils.lerp(CLOSED_HINGE, OPEN_HINGE, openness);
    spine.scale.x = bands.scale.x = 1 - openness * .24;
    spine.scale.y = bands.scale.y = 1 - openness * .90;
    spine.position.y = bands.position.y = OPEN_HINGE * openness * .90;
    const turn = motion.phase === 'turning';
    const leftCount = motion.page - (turn && motion.direction < 0 ? 1 : 0);
    const rightCount = LEAF_COUNT - motion.page - (turn && motion.direction > 0 ? 1 : 0);
    leftBlock.visible = leftPage.visible = leftCount > 0;
    rightBlock.visible = rightPage.visible = rightCount > 0;
    if (leftCount !== lastLeft || openness !== lastOpen) {
      sizePageBlock(leftBlock.geometry, leftCount, openness);
      bendLeaf(leftPage.geometry, 1, PAGE_BASE + leftCount * SHEET_STEP + .001, openness);
      leftPage.material = materials.paper[Math.max(0, leftCount - 1) % 3]; lastLeft = leftCount;
    }
    if (rightCount !== lastRight || openness !== lastOpen) {
      sizePageBlock(rightBlock.geometry, rightCount, openness);
      bendLeaf(rightPage.geometry, 0, PAGE_BASE + rightCount * SHEET_STEP + .001, openness);
      rightPage.material = materials.paper[motion.page % 3]; lastRight = rightCount;
    }
    lastOpen = openness;
    // A gathered left-hand stack returns with the board when closing. It
    // settles above the remaining right-hand pages, then resets under cover.
    left.rotation.z = (openness - 1) * Math.PI;
    left.position.y = (1 - openness) * (2 * PAGE_BASE + LEAF_COUNT * SHEET_STEP);
    turning.visible = turn;
    if (turn) {
      const t = motion.turnProgress, eased = t * t * (3 - 2 * t);
      const p = motion.direction > 0 ? eased : 1 - eased;
      const root = PAGE_BASE + THREE.MathUtils.lerp(LEAF_COUNT - motion.index, motion.index + 1, p) * SHEET_STEP + .002;
      bendLeaf(turning.geometry, p, root); turning.material = materials.paper[motion.index % 3];
    }
    group.updateMatrixWorld(true);
  }
  updateGeometry();
  return {
    group, motion,
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

function spineGeometry() {
  const p = [], uv = [], indices = [], rows = 32, columns = 16;
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
    const a = i / rows * Math.PI;
    p.push(-.015 - Math.sin(a) * .12, .204 + Math.cos(a) * .164, (j / columns - .5) * COVER_DEPTH);
    uv.push(i / rows, j / columns);
    if (i < rows && j < columns) {
      const n = i * (columns + 1) + j, b = n + columns + 1;
      indices.push(n, b, n + 1, b, b + 1, n + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
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
