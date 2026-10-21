import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Actual bevelled glyph outlines, lying on the wood and catching the room light. */
export async function createEmbossing(surfaceY) {
  const svg = await new SVGLoader().loadAsync(`${import.meta.env.BASE_URL}ornaments/wildfell-hall.svg`);
  const shapes = svg.paths.flatMap(path => SVGLoader.createShapes(path));
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 1.35, bevelEnabled: true, bevelThickness: .34, bevelSize: .32, bevelSegments: 3, curveSegments: 10,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const scale = 4.2 / (box.max.x - box.min.x);
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, 0);
  // SVG y is downward. Reverse it before laying the lettering onto the tabletop.
  geometry.scale(scale, -scale, scale);
  // The reflection reverses triangle winding. Restore outward-facing surfaces.
  reverseWinding(geometry);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const gold = new THREE.MeshStandardMaterial({ color: '#c69b43', metalness: .86, roughness: .31, envMapIntensity: 1.45 });
  const lettering = new THREE.Mesh(geometry, gold);
  lettering.name = 'Wildfell Hall — embossed gold script';
  lettering.position.set(0, surfaceY + .012, -3.78);
  lettering.castShadow = lettering.receiveShadow = true;
  return lettering;
}

function reverseWinding(geometry) {
  for (const attribute of Object.values(geometry.attributes)) {
    for (let i = 0; i < attribute.count; i += 3) {
      for (let component = 0; component < attribute.itemSize; component++) {
        const a = (i + 1) * attribute.itemSize + component;
        const b = (i + 2) * attribute.itemSize + component;
        [attribute.array[a], attribute.array[b]] = [attribute.array[b], attribute.array[a]];
      }
    }
    attribute.needsUpdate = true;
  }
}

/** Acanthus scrolls, veined leaves, rosettes and bead-and-reel moulding.
 *  All relief is geometry. Merge by finish so added detail costs only 3 draw calls.
 */
export function createCarvings(paint, edgePaint, shadowPaint) {
  const root = new THREE.Group();
  root.name = 'carved-acanthus-and-beaded-mouldings';
  const parts = [[], [], []];
  const finishes = [paint, edgePaint, shadowPaint];
  let frame = new THREE.Matrix4();
  const v = (x, y, relief = .02) => new THREE.Vector3(x, -y, relief);

  function add(geometry, finish = 0, matrix = new THREE.Matrix4()) {
    let placed = geometry.index ? geometry.toNonIndexed() : geometry;
    if (placed !== geometry) geometry.dispose();
    const transform = new THREE.Matrix4().multiplyMatrices(frame, matrix);
    placed.applyMatrix4(transform);
    if (transform.determinant() < 0) reverseWinding(placed);
    parts[finish].push(placed);
  }
  function place(x, y, angle = 0, scale = 1, depth = 0) {
    return new THREE.Matrix4().compose(v(x, y, depth), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle), new THREE.Vector3(scale, scale, scale));
  }
  function stroke(points, radius = .018, finish = 1) {
    const curve = new THREE.CubicBezierCurve3(...points.map(p => v(...p)));
    add(new THREE.TubeGeometry(curve, 24, radius, 6, false), finish);
    return curve;
  }
  function leaf(x, y, angle, length = .30, width = .13) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(length * .1, width * .2, length * .10, width * .85, length * .31, width * .54);
    shape.bezierCurveTo(length * .32, width, length * .54, width * .94, length * .59, width * .41);
    shape.bezierCurveTo(length * .74, width * .53, length * .84, width * .23, length, 0);
    shape.bezierCurveTo(length * .78, -width * .04, length * .74, -width * .65, length * .55, -width * .42);
    shape.bezierCurveTo(length * .43, -width * .89, length * .25, -width * .73, length * .27, -width * .32);
    shape.bezierCurveTo(length * .13, -width * .45, length * .07, -width * .16, 0, 0);
    const leafFrame = place(x, y, angle, 1, .012);
    add(new THREE.ExtrudeGeometry(shape, { depth: .016, bevelEnabled: true, bevelSize: .009, bevelThickness: .012, bevelSegments: 2, curveSegments: 6 }), 0, leafFrame);
    const vein = new THREE.CubicBezierCurve3(new THREE.Vector3(.02, 0, .043), new THREE.Vector3(length * .30, .015, .048), new THREE.Vector3(length * .7, .006, .043), new THREE.Vector3(length * .94, 0, .027));
    add(new THREE.TubeGeometry(vein, 14, .005, 4, false), 2, leafFrame);
    for (const t of [.29, .49, .67]) {
      for (const side of [-1, 1]) {
        const rib = new THREE.CubicBezierCurve3(new THREE.Vector3(length * t, 0, .042), new THREE.Vector3(length * (t + .04), side * width * .2, .041), new THREE.Vector3(length * (t + .1), side * width * .4, .035), new THREE.Vector3(length * (t + .12), side * width * .48, .028));
        add(new THREE.TubeGeometry(rib, 6, .003, 3, false), 1, leafFrame);
      }
    }
  }
  function foliate(points, count = 7, size = .32) {
    const curve = stroke(points, .023);
    for (let i = 0; i < count; i++) {
      const t = .12 + i * .76 / count;
      const point = curve.getPoint(t), tangent = curve.getTangent(t);
      const angle = Math.atan2(-tangent.y, tangent.x);
      const length = size * (.75 + Math.sin(t * Math.PI) * .35);
      leaf(point.x, -point.y, angle + .77, length, length * .40);
      leaf(point.x, -point.y, angle - .81, length * .85, length * .35);
    }
  }
  function rosette(x, y, radius = .20) {
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      const petal = new THREE.SphereGeometry(1, 10, 6);
      const transform = place(x + Math.cos(angle) * radius * .52, y + Math.sin(angle) * radius * .52, angle);
      transform.scale(new THREE.Vector3(radius * .55, radius * .21, .028));
      add(petal, i % 2, transform);
    }
    const center = place(x, y, 0, 1, .023).scale(new THREE.Vector3(radius * .23, radius * .23, .04));
    add(new THREE.SphereGeometry(1, 12, 8), 0, center);
  }
  function setTopFrame(x, z, angle = 0) {
    frame = new THREE.Matrix4().makeTranslation(x, .145, z)
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationZ(angle));
  }

  // Generous carved corner brackets, with paired scrolls and fluted leaves.
  for (const [x, z, angle] of [[-7.55, -4.52, 0], [7.55, -4.52, -Math.PI / 2], [7.55, 4.52, Math.PI], [-7.55, 4.52, Math.PI / 2]]) {
    setTopFrame(x, z, angle);
    foliate([[.02, 1.65], [.03, .49], [.5, .05], [1.7, .02]], 10, .31);
    foliate([[.12, 1.39], [.98, 1.35], [1.36, .5], [.78, .43]], 7, .24);
    stroke([[.78, .43], [.40, .38], [.44, .91], [.79, .82]], .024);
    stroke([[.79, .82], [.98, .73], [.79, .56], [.71, .66]], .019);
    foliate([[.19, .75], [.8, .43], [.51, .09], [.39, .23]], 4, .17);
    foliate([[.62, 1.1], [.74, 1.63], [1.40, 1.54], [1.36, 1.07]], 5, .21);
    stroke([[1.36, 1.07], [1.3, .82], [1.04, .97], [1.19, 1.13]], .016);
    rosette(.18, .19, .18);
    rosette(1.18, 1.24, .095);
  }

  // Small running scrolls on the top rim leave the entire centre usable.
  for (const z of [-4.59, 4.59]) {
    for (let x = -5.8; x < 6; x += .72) {
      setTopFrame(x, z, z < 0 ? 0 : Math.PI);
      stroke([[-.3, 0], [-.12, -.16], [.12, .16], [.3, 0]], .012);
      leaf(-.04, .015, -.53, .19, .065);
      leaf(.04, -.015, Math.PI - .53, .19, .065);
    }
  }

  // A double bead-and-reel edge, consolidated into a single mesh per paint finish.
  const bead = (x, z, i) => {
    setTopFrame(x, z);
    add(new THREE.SphereGeometry(1, 8, 6), i % 4 === 0 ? 1 : 0, new THREE.Matrix4().makeScale(i % 4 === 0 ? .047 : .025, .025, .018));
  };
  for (let i = 0; i <= 132; i++) {
    const x = -7.65 + i * 15.3 / 132;
    bead(x, -4.78, i); bead(x, 4.78, i);
  }
  for (let i = 0; i <= 80; i++) {
    const z = -4.66 + i * 9.32 / 80;
    bead(-7.78, z, i); bead(7.78, z, i);
  }

  // Carved drawer garlands and a scallop-shell pendant below the central drawer.
  for (const x of [-5.02, 0, 5.02]) {
    frame = new THREE.Matrix4().makeTranslation(x, -.76, 4.967);
    for (const side of [-1, 1]) {
      foliate([[side * .55, .06], [side * 1.0, .15], [side * 1.42, -.13], [side * 1.8, -.02]], 6, .18);
      rosette(side * 1.88, -.02, .095);
    }
  }
  frame = new THREE.Matrix4().makeTranslation(0, -1.10, 4.83);
  for (let i = 0; i < 11; i++) {
    const angle = -Math.PI * .88 + i * Math.PI * .076;
    const x = Math.cos(angle) * .40, y = Math.sin(angle) * .34;
    stroke([[0, .24, .01], [x * .55, .12, .045], [x * 1.1, y + .16, .07], [x, y + .12, .02]], .026);
  }
  for (const side of [-1, 1]) foliate([[0, .26], [side * .35, .47], [side * .73, .20], [side * .58, -.03]], 5, .20);

  for (let i = 0; i < parts.length; i++) {
    const merged = mergeGeometries(parts[i]);
    const mesh = new THREE.Mesh(merged, finishes[i]);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    for (const geometry of parts[i]) geometry.dispose();
  }
  return root;
}

export async function createCarpet(renderer) {
  const loader = new THREE.TextureLoader();
  const base = import.meta.env.BASE_URL;
  const [color, height] = await Promise.all([
    loader.loadAsync(`${base}materials/rose-carpet-color.webp`),
    loader.loadAsync(`${base}materials/rose-carpet-height.webp`),
  ]);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = height.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const group = new THREE.Group();
  group.name = 'ornate-rose-and-ivory-carpet';
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(20.6, 17.2), new THREE.MeshStandardMaterial({ map: color, bumpMap: height, bumpScale: .032, roughness: .98, color: '#fff4f6' }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = -3.455;
  carpet.receiveShadow = true;
  group.add(carpet);
  // Bound wool edge and fine cream fringe are separate from the woven field.
  const edge = new THREE.Mesh(new THREE.BoxGeometry(20.66, .045, 17.26), new THREE.MeshStandardMaterial({ color: '#c99ba9', roughness: 1 }));
  edge.position.y = -3.485;
  edge.receiveShadow = true;
  group.add(edge);
  const fringePositions = [];
  for (let i = 0; i < 620; i++) {
    const x = -10.27 + i * 20.54 / 619;
    const length = .14 + .045 * Math.sin(i * 2.76);
    for (const side of [-1, 1]) fringePositions.push(x, -3.46, side * 8.61, x + Math.sin(i * 1.7) * .014, -3.47, side * (8.61 + length));
  }
  const fringeGeometry = new THREE.BufferGeometry();
  fringeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fringePositions, 3));
  group.add(new THREE.LineSegments(fringeGeometry, new THREE.LineBasicMaterial({ color: '#ead9ca' })));
  return group;
}
