import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WIDTH = 308, HEIGHT = 86;

function roundedRectangle(width, height, radius) {
  const x = width / 2, y = height / 2, s = new THREE.Shape();
  s.moveTo(-x + radius, -y); s.lineTo(x - radius, -y);
  s.quadraticCurveTo(x, -y, x, -y + radius); s.lineTo(x, y - radius);
  s.quadraticCurveTo(x, y, x - radius, y); s.lineTo(-x + radius, y);
  s.quadraticCurveTo(-x, y, -x, y - radius); s.lineTo(-x, -y + radius);
  s.quadraticCurveTo(-x, -y, -x + radius, -y);
  return s;
}

function moldingGeometry() {
  const outline = roundedRectangle(284, 50, 9), segments = 384;
  // A closed section: sight edge, round bead, hollow, broad ovolo and outer
  // lip. Every highlight comes from its surface normal, including the corners.
  const profile = [[-5.8, -1.8], [-5.8, .9], [-5.5, 1.5], [-5.0, 1.8], [-4.5, 1.6],
    [-4.0, .9], [-3.4, .55], [-2.8, 1.0], [-1.8, 2.4], [-.7, 3.1], [.5, 3.3],
    [1.6, 2.9], [2.5, 2.0], [3.3, 1.0], [3.8, .75], [4.3, 1.1], [4.9, 1.5],
    [5.5, 1.4], [6.1, .8], [6.5, -.2], [6.5, -1.8]];
  const p = [], uv = [], indices = [], n = profile.length;
  for (let i = 0; i < segments; i++) {
    const point = outline.getPointAt(i / segments), tangent = outline.getTangentAt(i / segments).normalize();
    for (let j = 0; j < n; j++) {
      const [offset, z] = profile[j], x = point.x + tangent.y * offset, y = point.y - tangent.x * offset;
      p.push(x, y, z); uv.push(x / 32, y / 32);
      const a = i * n + j, b = (i + 1) % segments * n + j;
      const c = i * n + (j + 1) % n, d = (i + 1) % segments * n + (j + 1) % n;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function leafGeometry(length, width, height) {
  const rows = 28, columns = 14, p = [], uv = [], indices = [];
  for (let i = 0; i <= rows; i++) {
    const t = (i + .015) / (rows + .03), envelope = Math.pow(Math.sin(Math.PI * t), .72);
    for (let j = 0; j <= columns; j++) {
      const s = j / columns * 2 - 1;
      const lobes = 1 + .14 * Math.sin(t * Math.PI * 7);
      const shoulder = Math.pow(Math.max(0, 1 - s * s), 1.2);
      const veins = .15 * Math.sin((t - Math.abs(s) * .17) * Math.PI * 8) * Math.sin(Math.PI * Math.abs(s));
      p.push(t * length, s * width * envelope * lobes,
        -.13 + height * envelope * shoulder * (1 + veins));
      uv.push(t, j / columns);
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j, b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function metalTexture() {
  const data = new Uint8Array(256 * 128 * 4); let seed = 1849;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 176 + (seed / 4294967296 - .5) * 28 + Math.sin(y * .23 + x * .03) * 7;
    data.set([value, value, value, 255], (y * 256 + x) * 4);
  }
  const texture = new THREE.DataTexture(data, 256, 128);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

export function createFrameMetalwork() {
  const texture = metalTexture();
  // The desk's chased brass is #9c7844, metalness .84, roughness .39.
  const brass = new THREE.MeshStandardMaterial({ color: '#9c7844', metalness: .84,
    roughness: .61, roughnessMap: texture, bumpMap: texture, bumpScale: .018 });
  const polished = brass.clone(); polished.roughness = .46;
  const group = new THREE.Group(); group.name = 'cast-brass-picture-frame'; group.position.y = -1;
  const molding = new THREE.Mesh(moldingGeometry(), brass); molding.name = 'continuous-cast-molding';
  group.add(molding);
  const relief = [];
  function add(geometry, x = 0, y = 0, z = 0, angle = 0, sx = 1, sy = 1, sz = 1) {
    geometry.scale(sx, sy, sz); geometry.rotateZ(angle); geometry.translate(x, y, z);
    if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat; }
    const positions = geometry.attributes.position, uv = geometry.attributes.uv;
    // A consistent, very fine worked-metal finish across raised ornament.
    for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / 32, positions.getY(i) / 32);
    relief.push(geometry);
  }
  function stem(points, radius = .55) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve, 36, radius, 10, false));
  }
  // Reflect the ornament's placement, not its mesh: the relief keeps outward
  // facing normals and catches the same light on all four sides of the frame.
  function leaf(length, width, height, x, y, z, angle, sx = 1, sy = 1) {
    add(leafGeometry(length, width, height), sx * x, sy * y, z,
      Math.atan2(sy * Math.sin(angle), sx * Math.cos(angle)));
  }
  function scroll(points, sx, sy, radius = .55) {
    stem(points.map(([x, y, z]) => [sx * x, sy * y, z]), radius);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx * 139, y = sy * 23;
    // Layered acanthus fans follow the corner, with a low outer leaf behind
    // the taller central fold. Their roots sink into the continuous molding.
    leaf(22, 2.5, 1.35, 139, 23.7, 2.45, Math.PI - .32, sx, sy);
    leaf(16, 2.0, 1.15, 137, 23.5, 2.7, Math.PI + .17, sx, sy);
    leaf(25, 3.0, 1.9, 139, 23, 2.85, Math.PI - .06, sx, sy);
    leaf(18, 2.2, 1.35, 140, 23, 2.45, -Math.PI / 2 + .24, sx, sy);
    leaf(13, 1.8, 1.1, 139, 21, 2.65, -Math.PI / 2 - .13, sx, sy);
    leaf(19, 2.5, 1.8, 139, 23, 2.85, -Math.PI / 2 + .04, sx, sy);
    // A rounded volute joins the two fans, rooted in the molding.
    stem([[x - sx * 4, y + sy * 1, 3.2], [x - sx * 1, y + sy * 5, 3.7],
      [x + sx * 4, y + sy * 4, 3.7], [x + sx * 5, y, 3.6],
      [x + sx * 2, y - sy * 2, 3.4], [x, y, 3.0]], .7);
    for (let petal = 0; petal < 7; petal++) {
      add(leafGeometry(2.8, .78, .7), x, y, 3.35, petal * Math.PI * 2 / 7);
    }
    add(new THREE.SphereGeometry(1, 16, 12), x, y, 3.8, 0, 1.05, 1.05, .7);
  }
  // Symmetrical foliate sprays have space between their leaves so the broad
  // ovolo's uninterrupted highlights still describe the underlying casting.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    scroll([[38, 25, 2.9], [49, 28, 3.6], [62, 23.8, 3.7], [76, 27.4, 3.6],
      [87, 28.3, 3.5], [93, 25.7, 3.7], [90, 23.3, 3.6], [87, 24.5, 3.5],
      [88, 26, 3.3]], sx, sy, .5);
    leaf(12, 2.3, 1.25, 48, 26.5, 3.0, .37, sx, sy);
    leaf(12, 2.1, 1.2, 66, 25, 3.1, Math.PI + .23, sx, sy);
    leaf(10, 2.0, 1.2, 73, 26.5, 3.0, -.23, sx, sy);
    leaf(9, 1.7, 1.05, 80, 28, 2.9, .25, sx, sy);
    leaf(8, 1.4, .85, 43, 26.4, 2.9, Math.PI + .1, sx, sy);
    leaf(7, 1.5, .9, 96, 25.5, 2.9, .12, sx, sy);
  }
  // A fluted shell and paired C-scrolls form a connected central crest.
  for (const sy of [-1, 1]) {
    const scale = sy === 1 ? 1 : .83;
    for (const sx of [-1, 1]) {
      scroll([[1, 28, 2.9], [7, 27.5, 3.5], [12, 32, 3.7], [18, 32.5, 3.7],
        [21, 29, 3.6], [18, 26.8, 3.5], [15.5, 28.3, 3.5], [17, 29.5, 3.3]], sx, sy, .65);
      leaf(12, 2.3, 1.25, 7, 28.5, 2.7, -.18, sx, sy);
      leaf(8, 1.6, 1.0, 20, 28, 2.7, -.12, sx, sy);
    }
    for (let rib = -4; rib <= 4; rib++) {
      const angle = rib * .21, length = (10.5 - Math.abs(rib) * .5) * scale;
      add(leafGeometry(length, 1.35 * scale, 1.25 * scale), 0, sy * 28, 2.6,
        sy * Math.PI / 2 + angle, 1, 1, 1);
    }
    add(new THREE.SphereGeometry(1, 16, 12), 0, sy * 28, 3.25, 0, 2.0, 1.25, 1.0);
  }
  const carving = new THREE.Mesh(mergeGeometries(relief), brass); carving.name = 'cast-acanthus-and-scrollwork';
  relief.forEach(g => g.dispose()); group.add(carving);
  const beadOutline = roundedRectangle(274, 40.2, 5.5);
  const beadCount = Math.round(beadOutline.getLength() / 3.5);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(.6, 10, 8), polished, beadCount);
  beads.name = 'inner-bead-molding';
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < beadCount; i++) {
    const point = beadOutline.getPointAt(i / beadCount);
    matrix.makeTranslation(point.x, point.y, 1.7); beads.setMatrixAt(i, matrix);
  }
  group.add(beads);
  // Fine diagonal chasing sits in the outer lip, below the foliate relief.
  // Instancing keeps this continuous perimeter detail to a single draw call.
  const chasedOutline = roundedRectangle(294, 60, 14), chaseCount = Math.round(chasedOutline.getLength() / 2.15);
  const chasing = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), brass, chaseCount);
  chasing.name = 'chased-outer-fillet';
  const rotation = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1), scale = new THREE.Vector3(.85, .28, .26);
  for (let i = 0; i < chaseCount; i++) {
    const t = i / chaseCount, point = chasedOutline.getPointAt(t), tangent = chasedOutline.getTangentAt(t);
    rotation.setFromAxisAngle(axis, Math.atan2(tangent.y, tangent.x) - .48);
    matrix.compose(new THREE.Vector3(point.x, point.y, 1.65), rotation, scale); chasing.setMatrixAt(i, matrix);
  }
  group.add(chasing);
  group.traverse(object => { if (object.isMesh) object.castShadow = object.receiveShadow = true; });
  return group;
}

export async function createControlFrame(host) {
  const canvas = host.querySelector('canvas');
  const linen = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}materials/control-linen.webp`);
  // This small transparent canvas has its own context; the desk's compositor
  // and camera never need to move or redraw merely to lay out the controls.
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, .1, 1000);
  camera.position.set(0, 0, 300); camera.lookAt(0, 0, 0);
  let environment;
  function refreshEnvironment() {
    environment?.dispose();
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, .08); scene.environment = environment.texture; scene.environmentIntensity = .25;
    room.dispose(); pmrem.dispose();
  }
  refreshEnvironment();
  const metalwork = createFrameMetalwork(); scene.add(metalwork);
  linen.colorSpace = THREE.SRGBColorSpace; linen.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  linen.wrapS = linen.wrapT = THREE.RepeatWrapping; linen.repeat.set(1 / 256, 1 / 128);
  const backing = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectangle(274, 43, 4), 24),
    new THREE.MeshStandardMaterial({ map: linen, color: '#fffdf6', roughness: 1 }));
  backing.position.set(0, -1, -1.4); backing.receiveShadow = true; scene.add(backing);
  const key = new THREE.DirectionalLight('#fff0d6', 3.05); key.position.set(-110, 140, 180);
  key.castShadow = true; key.shadow.mapSize.set(1024, 512);
  Object.assign(key.shadow.camera, { left: -180, right: 180, top: 100, bottom: -100, near: .5, far: 600 });
  key.shadow.bias = -.0001; key.shadow.normalBias = .1; key.shadow.radius = 3;
  const sky = new THREE.HemisphereLight('#e9edf1', '#8d7561', .42);
  const fill = new THREE.DirectionalLight('#dfe7ee', .32); fill.position.set(120, 0, 100);
  scene.add(key, key.target, sky, fill);
  const afternoon = new THREE.Color('#fff0d6'), evening = new THREE.Color('#ffcb94');
  const daySky = new THREE.Color('#e9edf1'), nightSky = new THREE.Color('#b9c0d0');
  let light = 0, renderedLight = -1, width = 0, height = 0, available = true, dirty = true;
  function render(value = light) {
    light = value;
    if (!available || host.hidden) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (width !== rect.width || height !== rect.height) {
      width = rect.width; height = rect.height; renderer.setSize(width, height, false); dirty = true;
    }
    if (!dirty && Math.abs(light - renderedLight) < .001) return;
    key.color.copy(afternoon).lerp(evening, light); key.intensity = 3.05 - light * .95;
    sky.color.copy(daySky).lerp(nightSky, light); sky.intensity = .42 - light * .10;
    renderer.toneMappingExposure = .94 - light * .06;
    if (dirty) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera); dirty = false; renderedLight = light;
    host.classList.add('has-metal-frame');
  }
  const observer = new ResizeObserver(() => render()); observer.observe(host);
  function loseContext(event) {
    event.preventDefault(); available = false; host.classList.remove('has-metal-frame');
  }
  function restoreContext() {
    // Render-target textures have no CPU image to re-upload after context loss.
    refreshEnvironment(); available = true; dirty = true; render();
  }
  canvas.addEventListener('webglcontextlost', loseContext);
  canvas.addEventListener('webglcontextrestored', restoreContext);
  function dispose() {
    observer.disconnect(); available = false; host.classList.remove('has-metal-frame');
    canvas.removeEventListener('webglcontextlost', loseContext); canvas.removeEventListener('webglcontextrestored', restoreContext);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(object => {
      if (!object.isMesh) return;
      geometries.add(object.geometry); materials.add(object.material);
    });
    for (const material of materials) {
      for (const key of ['map', 'roughnessMap', 'bumpMap']) if (material[key]) textures.add(material[key]);
      material.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
    environment.dispose(); renderer.dispose();
  }
  return { render, dispose };
}
