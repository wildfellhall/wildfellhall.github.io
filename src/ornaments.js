import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export async function createEmbossing(surfaceY) {
  const svg = await new SVGLoader().loadAsync(`${import.meta.env.BASE_URL}ornaments/wildfell-hall.svg`);
  const geometry = new THREE.ExtrudeGeometry(svg.paths.flatMap(path => SVGLoader.createShapes(path)), {
    depth: .65, bevelEnabled: true, bevelThickness: .35, bevelSize: .38, bevelSegments: 3, curveSegments: 12,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, center = box.getCenter(new THREE.Vector3());
  const scale = 3.05 / (box.max.x - box.min.x);
  geometry.translate(-center.x, -center.y, 0);
  geometry.scale(scale, -scale, scale);
  reverseWinding(geometry);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const lettering = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: '#967343', metalness: .78, roughness: .48, envMapIntensity: .8,
  }));
  lettering.position.set(0, surfaceY + .001, -2.52);
  lettering.name = 'shallow-gilt-lettering';
  lettering.castShadow = lettering.receiveShadow = true;
  return lettering;
}

function reverseWinding(geometry) {
  for (const attribute of Object.values(geometry.attributes)) {
    for (let i = 0; i < attribute.count; i += 3) for (let c = 0; c < attribute.itemSize; c++) {
      const a = (i + 1) * attribute.itemSize + c, b = (i + 2) * attribute.itemSize + c;
      [attribute.array[a], attribute.array[b]] = [attribute.array[b], attribute.array[a]];
    }
  }
}

// Rounded, undercut acanthus surfaces, not flat decals or line drawings.
export function createCarvings(paint, edgePaint, patina) {
  const root = new THREE.Group();
  root.name = 'hand-carved-flowers-acanthus-and-shells';
  const parts = [[], [], []], finishes = [paint, edgePaint, patina];
  let frame = new THREE.Matrix4();
  const at = (x, y, z = 0, angle = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle), new THREE.Vector3(1, 1, 1));
  function add(geometry, material = 0, transform = new THREE.Matrix4()) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    const matrix = frame.clone().multiply(transform);
    g.applyMatrix4(matrix);
    if (matrix.determinant() < 0) reverseWinding(g);
    // All merged pieces have the same attributes.
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    parts[material].push(g);
  }
  function stroke(points, radius = .035, material = 0) {
    const curve = new THREE.CubicBezierCurve3(...points.map(([x, y, z = .055]) => new THREE.Vector3(x, y, z)));
    add(new THREE.TubeGeometry(curve, 28, radius, 8, false), material);
    return curve;
  }
  function leaf(x, y, angle, length = .55, width = .22, relief = .075) {
    const vertices = [], uv = [], indices = [], rows = 26, columns = 10;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const envelope = Math.pow(Math.sin(Math.PI * t), .85);
      const lobes = .87 + .13 * Math.cos(t * Math.PI * 7);
      for (let j = 0; j <= columns; j++) {
        const s = j / columns * 2 - 1;
        vertices.push(t * length, s * width * envelope * lobes,
          .018 + relief * envelope * Math.pow(Math.max(0, 1 - s * s), 1.2) + .024 * Math.sin(t * Math.PI * 2));
        uv.push(t, j / columns);
        if (i < rows && j < columns) {
          const a = i * (columns + 1) + j, b = a + columns + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices); g.computeVertexNormals();
    add(g, 0, at(x, y, 0, angle));
    const ridge = new THREE.CubicBezierCurve3(new THREE.Vector3(.015, 0, .037), new THREE.Vector3(length * .26, 0, relief + .035), new THREE.Vector3(length * .68, 0, relief + .018), new THREE.Vector3(length * .98, 0, .026));
    add(new THREE.TubeGeometry(ridge, 20, .009, 5, false), 1, at(x, y, 0, angle));
  }
  function foliate(points, count = 6, size = .43) {
    const curve = stroke(points, .044, 1);
    for (let i = 0; i < count; i++) {
      const t = .08 + i * .80 / count, p = curve.getPoint(t), tangent = curve.getTangent(t);
      const angle = Math.atan2(tangent.y, tangent.x);
      const len = size * (.7 + .35 * Math.sin(t * Math.PI));
      leaf(p.x, p.y, angle + .86, len, len * .46);
      leaf(p.x, p.y, angle - .86, len * .9, len * .43);
    }
  }
  function rose(x, y, radius = .25) {
    for (const [count, r, depth] of [[9, radius * .64, .065], [7, radius * .33, .115]]) {
      for (let i = 0; i < count; i++) {
        const a = i * Math.PI * 2 / count;
        const matrix = at(x + Math.cos(a) * r, y + Math.sin(a) * r, depth, a);
        matrix.scale(new THREE.Vector3(radius * .53, radius * .25, .07));
        add(new THREE.SphereGeometry(1, 14, 8), 0, matrix);
      }
    }
    add(new THREE.SphereGeometry(1, 16, 10), 1, at(x, y, .14).scale(new THREE.Vector3(radius * .22, radius * .22, .075)));
  }
  function scroll(side, y, span = 2) {
    foliate([[side * .12, y], [side * .75, y - .42], [side * span, y - .25], [side * (span - .14), y + .18]], 5, .53);
    stroke([[side * (span - .14), y + .18], [side * (span - .22), y + .51], [side * (span - .88), y + .40], [side * (span - .68), y + .11]], .042);
    stroke([[side * (span - .68), y + .11], [side * (span - .5), y - .04], [side * (span - .33), y + .19], [side * (span - .50), y + .22]], .032);
    leaf(side * (span - .3), y + .30, side > 0 ? 2.6 : .54, .53, .21);
  }

  // The largest carving lives on the visible furniture, not in the writing area.
  for (const x of [-4.82, 4.82]) {
    frame = at(x, -1.02, 3.51);
    for (const side of [-1, 1]) {
      foliate([[side * .32, .02], [side * .73, -.38], [side * 1.45, -.22], [side * 1.65, .20]], 4, .42);
      stroke([[side * 1.65, .20], [side * 1.43, .50], [side * 1.03, .15], [side * 1.35, .04]], .03);
      rose(side * 1.72, -.12, .14);
    }
  }
  frame = at(0, -1.03, 3.56);
  rose(0, .12, .22);
  for (const side of [-1, 1]) {
    foliate([[side * .25, .14], [side * .48, .43], [side * .85, .40], [side * 1, .18]], 4, .25);
    foliate([[side * .25, -.25], [side * .8, -.46], [side * 1.45, -.42], [side * 1.85, -.13]], 5, .29);
  }
  frame = at(0, -1.96, 3.43);
  for (const side of [-1, 1]) scroll(side, .02, 2.45);
  // A fan shell with deeply modelled ribs and a curled lower tip.
  for (let i = 0; i < 13; i++) {
    const a = .15 + i / 12 * (Math.PI - .30);
    const endX = Math.cos(a) * .57, endY = Math.sin(a) * .55;
    stroke([[0, -.26, .06], [endX * .45, -.07, .18], [endX * 1.12, endY * .75, .13], [endX, endY, .04]], .034, i % 3 ? 0 : 1);
  }
  rose(0, -.22, .13);
  for (const x of [-4.85, 4.85]) {
    frame = at(x, -1.83, 3.35);
    for (const side of [-1, 1]) foliate([[0, 0], [side * .45, -.22], [side * 1.15, -.16], [side * 1.6, .06]], 4, .43);
    rose(0, -.06, .17);
  }

  // Carved knees and cascading acanthus on each cabriole leg.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    frame = new THREE.Matrix4().makeTranslation(sx * 6.75, -2.03, sz * 3.48)
      .multiply(new THREE.Matrix4().makeRotationY(sz > 0 ? sx * .23 : Math.PI - sx * .23));
    rose(0, .20, .24);
    leaf(0, .05, -Math.PI / 2, 1.05, .28, .095);
    for (const side of [-1, 1]) {
      leaf(side * .04, .08, -Math.PI / 2 + side * .65, .72, .22, .09);
      stroke([[side * .05, .44], [side * .43, .52], [side * .44, -.05], [side * .23, -.23]], .048);
    }
  }
  // Both side aprons receive the same pierced-looking scrollwork.
  for (const side of [-1, 1]) {
    frame = new THREE.Matrix4().makeTranslation(side * 7.20, -1.2, 0).multiply(new THREE.Matrix4().makeRotationY(side * Math.PI / 2));
    rose(0, -.02, .27);
    for (const s of [-1, 1]) scroll(s, -.10, 2.15);
  }
  // Restrained corner details and a fine pearl edge leave a clear writing surface.
  for (const [x, z, rotation] of [[-7.12, -3.23, 0], [7.12, -3.23, -Math.PI / 2], [7.12, 3.15, Math.PI], [-7.12, 3.15, Math.PI / 2]]) {
    frame = new THREE.Matrix4().makeTranslation(x, .203, z).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(rotation)).multiply(new THREE.Matrix4().makeScale(.9, .9, .4));
    foliate([[0, -.95], [.02, -.15], [.30, -.02], [1, 0]], 5, .22);
    stroke([[.15, -.60], [.85, -.72], [.72, -.13], [.48, -.27]], .023);
    rose(.16, -.15, .10);
  }
  for (let i = 0; i < 150; i++) {
    const x = -7.20 + i * 14.40 / 149;
    frame = at(x, -.22, 3.68 - .10 * Math.cos(x * Math.PI / 7.2));
    add(new THREE.SphereGeometry(1, 8, 6), 1, new THREE.Matrix4().makeScale(.031, .035, .025));
  }
  for (let i = 0; i < parts.length; i++) if (parts[i].length) {
    const mesh = new THREE.Mesh(mergeGeometries(parts[i]), finishes[i]);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    parts[i].forEach(g => g.dispose());
  }
  return root;
}

export async function createCarpet(renderer) {
  const loader = new THREE.TextureLoader();
  const [color, height] = await Promise.all(['rose-carpet-color', 'rose-carpet-height'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}materials/${name}.webp?v=aubusson-2`)));
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = height.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const group = new THREE.Group();
  group.name = 'antique-blush-aubusson-rug';
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(19, 13.7), new THREE.MeshStandardMaterial({ map: color, bumpMap: height, bumpScale: .018, roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, -5.99, .2);
  carpet.receiveShadow = true;
  group.add(carpet);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(19.03, .055, 13.73), new THREE.MeshStandardMaterial({ color: '#ad8c81', roughness: 1 }));
  edge.position.set(0, -6.03, .2); edge.receiveShadow = true; group.add(edge);
  const positions = [];
  for (let i = 0; i < 510; i++) {
    const x = -9.48 + i * 18.96 / 509;
    for (const side of [-1, 1]) positions.push(x, -6.035, .2 + side * 6.86, x + .018 * Math.sin(i * 7), -6.055, .2 + side * (7.04 + .04 * Math.sin(i * 1.7)));
  }
  const fringe = new THREE.BufferGeometry();
  fringe.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  group.add(new THREE.LineSegments(fringe, new THREE.LineBasicMaterial({ color: '#cbbb9e' })));
  return group;
}
