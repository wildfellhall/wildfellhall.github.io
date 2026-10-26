import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { desktopOutline, perimeterFrame, legProfile } from './furniture-profiles.js';
import { createNameCrestMetalwork, crestFieldHeight, crestFieldGradient } from './name-crest.js';

export async function createEmbossing(surfaceY, brass) {
  const svg = await new SVGLoader().loadAsync(`${import.meta.env.BASE_URL}ornaments/wildfell-hall.svg`);
  const geometry = new THREE.ExtrudeGeometry(svg.paths.flatMap(path => SVGLoader.createShapes(path)), {
    depth: 4, bevelEnabled: true, bevelThickness: 1, bevelSize: .85, bevelSegments: 5, curveSegments: 24,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, center = box.getCenter(new THREE.Vector3());
  const scale = 3.42 / (box.max.x - box.min.x);
  geometry.translate(-center.x, -center.y, 0);
  geometry.scale(scale, -scale, .022 / 4);
  reverseWinding(geometry); geometry.computeVertexNormals();
  // The embossing follows the slight crown of the metal field; its lower
  // bevel remains embedded across every letter, without floating edges.
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const gradient = new THREE.Vector2(), normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    positions.setZ(i, positions.getZ(i) + crestFieldHeight(x, y));
    // Transform the original normals with the curved surface, keeping the
    // polished faces smooth across the font's triangulation.
    crestFieldGradient(x, y, gradient); normal.fromBufferAttribute(normals, i);
    normal.set(normal.x - gradient.x * normal.z, normal.y - gradient.y * normal.z, normal.z).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  const face = brass.clone(); face.color.set('#e2c581'); face.metalness = .90; face.roughness = .28;
  const bevel = brass.clone(); bevel.color.set('#bb9857'); bevel.roughness = .29;
  const lettering = new THREE.Mesh(geometry, [face, bevel]);
  lettering.position.z = .001;
  lettering.name = 'burnished-gold-script-with-beveled-edges';
  lettering.castShadow = lettering.receiveShadow = true;
  const crest = createNameCrestMetalwork(brass);
  crest.add(lettering); crest.rotation.x = -Math.PI / 2;
  crest.scale.set(.72, .72, .62);
  // Bed the plaque's back bevel into the timber. The inscription and flowers
  // belong to the same physical object and receive the room's actual light.
  crest.position.set(0, surfaceY + .004, -2.35);
  return crest;
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
export function createCarvings(paint, edgePaint, patina, drawerGroups) {
  const root = new THREE.Group();
  root.name = 'hand-carved-flowers-acanthus-and-shells';
  const parts = [[], [], []], finishes = [paint, edgePaint, patina];
  function finishBatch(parent) {
    for (let i = 0; i < parts.length; i++) if (parts[i].length) {
      const mesh = new THREE.Mesh(mergeGeometries(parts[i]), finishes[i]);
      mesh.name = 'ivory-relief';
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      parts[i].forEach(g => g.dispose()); parts[i] = [];
    }
  }
  let frame = new THREE.Matrix4(), wrap = null;
  const at = (x, y, z = 0, angle = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle), new THREE.Vector3(1, 1, 1));
  function add(geometry, material = 0, transform = new THREE.Matrix4()) {
    let g = geometry;
    const matrix = frame.clone().multiply(transform);
    g.applyMatrix4(matrix);
    if (wrap) {
      const positions = g.attributes.position, p = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        wrap(positions.getX(i), positions.getY(i), positions.getZ(i), p);
        positions.setXYZ(i, p.x, p.y, p.z);
      }
      g.computeVertexNormals();
    }
    if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
    if (matrix.determinant() < 0) reverseWinding(g);
    // All merged pieces have the same attributes.
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    parts[material].push(g);
  }
  function stroke(points, radius = .035, material = 0) {
    const curve = new THREE.CubicBezierCurve3(...points.map(([x, y, z = radius * .50]) => new THREE.Vector3(x, y, z)));
    const geometry = new THREE.TubeGeometry(curve, 40, radius, 12, false), positions = geometry.attributes.position;
    // Ease the end of each stem into its backing instead of leaving an open,
    // blunt tube end above the timber.
    for (let row = 0; row <= 40; row++) {
      const t = row / 40, center = curve.getPointAt(t);
      const taper = .18 + .82 * THREE.MathUtils.smoothstep(t, 0, .08) * THREE.MathUtils.smoothstep(1 - t, 0, .08);
      for (let column = 0; column <= 12; column++) {
        const i = row * 13 + column;
        positions.setXYZ(i, center.x + (positions.getX(i) - center.x) * taper, center.y + (positions.getY(i) - center.y) * taper,
          center.z + (positions.getZ(i) - center.z) * taper - radius * (1 - taper));
      }
    }
    geometry.computeVertexNormals();
    add(geometry, material);
    return curve;
  }
  function leaf(x, y, angle, length = .55, width = .22, relief = .075) {
    const vertices = [], uv = [], indices = [], rows = length < .3 ? 16 : 36, columns = length < .3 ? 10 : 18;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const envelope = Math.pow(Math.sin(Math.PI * t), .78);
      const lobes = .76 + .24 * Math.pow(.5 + .5 * Math.cos(t * Math.PI * 10), .7);
      for (let j = 0; j <= columns; j++) {
        const s = j / columns * 2 - 1;
        // Incised branching veins are cut into the leaf surface itself so
        // side lighting catches their rounded shoulders and recessed channels.
        let channels = 0;
        for (const fork of [.20, .39, .58, .74]) channels += Math.exp(-Math.pow((t - fork - Math.abs(s) * .15) / .024, 2));
        const veinDepth = Math.min(.014, relief * .18) * channels * Math.sin(Math.PI * Math.abs(s)) * envelope;
        const shoulder = Math.pow(Math.max(0, 1 - s * s), 1.7);
        vertices.push(t * length, s * width * envelope * lobes,
          -.004 + shoulder * (relief * envelope + relief * .15 * Math.sin(t * Math.PI * 2) * envelope + relief * .22 * Math.pow(t, 8) * envelope) - veinDepth * shoulder);
        uv.push(t, j / columns);
        if (i < rows && j < columns) {
          const a = i * (columns + 1) + j, b = a + columns + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    // Close the carved perimeter into the backing timber. Rounded undercuts
    // now have thickness instead of an infinitely thin floating leaf edge.
    const boundary = [];
    for (let i = 0; i <= rows; i++) boundary.push(i * (columns + 1));
    for (let i = rows; i >= 0; i--) boundary.push(i * (columns + 1) + columns);
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], b = boundary[(i + 1) % boundary.length], start = vertices.length / 3;
      vertices.push(vertices[a * 3], vertices[a * 3 + 1], -.008, vertices[b * 3], vertices[b * 3 + 1], -.008);
      uv.push(uv[a * 2], uv[a * 2 + 1], uv[b * 2], uv[b * 2 + 1]);
      indices.push(a, start, b, b, start, start + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices); g.computeVertexNormals();
    add(g, 0, at(x, y, 0, angle));
    const veinRadius = Math.min(.006, width * .055);
    const ridge = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, e = Math.pow(Math.sin(Math.PI * t), .78);
      return new THREE.Vector3(t * length, 0, -.004 + relief * e * (1 + .15 * Math.sin(t * Math.PI * 2) + .22 * Math.pow(t, 8)) - veinRadius * .45);
    }));
    add(new THREE.TubeGeometry(ridge, 32, veinRadius, 7, false), 0, at(x, y, 0, angle));
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
    frame = at(x, -1.02, 3.470);
    for (const side of [-1, 1]) {
      foliate([[side * .32, .02], [side * .73, -.38], [side * 1.45, -.22], [side * 1.65, .20]], 4, .42);
      stroke([[side * 1.65, .20], [side * 1.43, .50], [side * 1.03, .15], [side * 1.35, .04]], .03);
      rose(side * 1.72, -.12, .14);
    }
    finishBatch(drawerGroups[x < 0 ? 0 : 2]);
  }
  frame = at(0, -1.03, 3.470);
  rose(0, .12, .22);
  for (const side of [-1, 1]) {
    foliate([[side * .25, .14], [side * .48, .43], [side * .85, .40], [side * 1, .18]], 4, .25);
    foliate([[side * .25, -.25], [side * .8, -.46], [side * 1.45, -.42], [side * 1.85, -.13]], 5, .29);
  }
  finishBatch(drawerGroups[1]);
  frame = at(0, -1.96, 3.367);
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
  // The apron relief stays below the drawer runners. Ease only its highest
  // curls down into the timber so they cannot pierce a sliding drawer bottom.
  let crest = -Infinity;
  for (const geometry of parts.flat()) {
    geometry.computeBoundingBox(); crest = Math.max(crest, geometry.boundingBox.max.y);
  }
  const clearance = Math.min(1, .27 / (crest + 1.8));
  for (const geometry of parts.flat()) {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (y > -1.8) positions.setY(i, -1.8 + (y + 1.8) * clearance);
    }
    geometry.computeVertexNormals();
  }
  finishBatch(root);

  // Knee rosettes, trailing acanthus, fine reeds and ankle buds all follow
  // the same curved cross-section as the leg, so none hover in front of it.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wrap = legProfile(sx, sz).wrap;
    frame.identity();
    rose(0, -2.30, .21);
    leaf(0, -2.40, -Math.PI / 2, .82, .18, .065);
    for (const side of [-1, 1]) {
      leaf(side * .035, -2.35, -Math.PI / 2 + side * .72, .60, .15, .055);
      stroke([[side * .04, -2.02, .016], [side * .36, -1.98, .025], [side * .35, -2.51, .027], [side * .18, -2.68, .018]], .025);
      stroke([[side * .15, -3.08, .008], [side * .12, -3.63, .012], [side * .07, -4.53, .010], [side * .06, -5.25, .008]], .012);
      for (let i = 0; i < 6; i++) {
        const y = -3.02 - i * .32, size = .38 - i * .032;
        leaf(side * .014, y, -Math.PI / 2 + side * .55, size, size * .30, .032 - i * .002);
      }
      leaf(side * .012, -5.22, -Math.PI / 2 + side * .42, .37, .065, .032);
    }
    stroke([[0, -2.86, .020], [0, -3.52, .019], [0, -4.52, .013], [0, -5.45, .012]], .014);
    // A small rolled leaf terminates the ornament at each scroll foot.
    stroke([[-.10, -5.54, .012], [-.12, -5.76, .025], [.13, -5.76, .028], [.10, -5.56, .018]], .019);
    leaf(-.035, -5.47, -Math.PI / 2 + .24, .22, .075, .035);
    wrap = null;
  }
  // Both side aprons receive the same pierced-looking scrollwork.
  for (const side of [-1, 1]) {
    frame = new THREE.Matrix4().makeTranslation(side * 7.20, -1.2, 0).multiply(new THREE.Matrix4().makeRotationY(side * Math.PI / 2));
    rose(0, -.02, .27);
    for (const s of [-1, 1]) scroll(s, -.10, 2.15);
  }
  // Restrained corner details and a fine pearl edge leave a clear writing surface.
  for (const [x, z, rotation] of [[-7.12, -3.23, 0], [7.12, -3.23, -Math.PI / 2], [7.12, 3.15, Math.PI], [-7.12, 3.15, Math.PI / 2]]) {
    frame = new THREE.Matrix4().makeTranslation(x, .203, z).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(rotation)).multiply(new THREE.Matrix4().makeScale(1.3, 1.3, .85));
    foliate([[0, -.95], [.02, -.15], [.30, -.02], [1, 0]], 7, .28);
    stroke([[.15, -.60], [.85, -.72], [.72, -.13], [.48, -.27]], .023);
    rose(.16, -.15, .15);
  }
  // A continuous low laurel ribbon follows the serpentine top rim, outside
  // the writing area. Separate bead-and-reel carving sits in the edge fillet.
  const rim = desktopOutline(14.96, 7.35), edge = desktopOutline(15.07, 7.46);
  const rimPoints = rim.getSpacedPoints(480).slice(0, -1).map(p => new THREE.Vector3(p.x, .208, p.y));
  frame.identity();
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints, true), 720, .010, 6, true), 1);
  const repeat = Math.round(rim.getLength() / .29);
  for (let i = 0; i < repeat; i++) {
    const { p, tangent, outward } = perimeterFrame(rim, i / repeat);
    frame.makeBasis(new THREE.Vector3(tangent.x, 0, tangent.y), new THREE.Vector3(outward.x, 0, outward.y), new THREE.Vector3(0, 1, 0)).setPosition(p.x, .203, p.y);
    const variation = 1 + .025 * Math.sin(i * 4.17);
    leaf(-.10, 0, .44, .22 * variation, .047, .020);
    leaf(-.10, 0, -.44, .22 * variation, .047, .020);
  }
  const beads = Math.round(edge.getLength() / .14);
  for (let i = 0; i < beads; i++) {
    const { p, tangent, outward } = perimeterFrame(edge, i / beads);
    frame.makeBasis(new THREE.Vector3(-tangent.x, 0, -tangent.y), new THREE.Vector3(0, 1, 0), new THREE.Vector3(outward.x, 0, outward.y)).setPosition(p.x + outward.x * .010, -.25, p.y + outward.y * .010);
    const scale = i % 3 ? new THREE.Vector3(.042, .033, .026) : new THREE.Vector3(.018, .041, .024);
    add(new THREE.SphereGeometry(1, 10, 8), 0, new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z));
  }
  finishBatch(root);
  return root;
}

export async function createCarpet(renderer) {
  const loader = new THREE.TextureLoader();
  const [color, height] = await Promise.all(['rose-carpet-color', 'rose-carpet-height'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}materials/${name}.webp?v=aubusson-3`)));
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
