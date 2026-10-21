import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCarvings, createEmbossing } from './ornaments.js';

export const DESK = Object.freeze({ width: 16, depth: 10, surfaceY: 0.12 });

// The writing plane is kept separate from the frame and drawers. Future objects
// can be attached here in world units, with y = DESK.surfaceY as the contact plane.
export async function createDesk(renderer) {
  const group = new THREE.Group();
  group.name = 'antique-writing-desk';
  const writingSurface = new THREE.Group();
  writingSurface.name = 'writing-surface-objects';
  writingSurface.position.y = DESK.surfaceY;
  group.add(writingSurface);
  const loader = new THREE.TextureLoader();
  const base = import.meta.env.BASE_URL;
  const [colorMap, bumpMap, roughnessMap] = await Promise.all([
    loader.loadAsync(`${base}materials/ivory-color.webp`),
    loader.loadAsync(`${base}materials/ivory-height.webp`),
    loader.loadAsync(`${base}materials/ivory-roughness.webp`),
  ]);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [colorMap, bumpMap, roughnessMap]) {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  const paint = new THREE.MeshStandardMaterial({ color: '#ebe7dc', roughness: .76, metalness: 0 });
  const shadowPaint = new THREE.MeshStandardMaterial({ color: '#c8c1af', roughness: .84 });
  const edgePaint = new THREE.MeshStandardMaterial({ color: '#e2ddcf', roughness: .67 });
  const wornPaint = new THREE.MeshStandardMaterial({ color: '#b7a68c', roughness: .81 });
  const wood = new THREE.MeshStandardMaterial({ map: colorMap, bumpMap, bumpScale: .024, roughnessMap, roughness: .94 });
  const brass = new THREE.MeshStandardMaterial({ color: '#8b713e', metalness: .83, roughness: .43 });
  const brassLight = new THREE.MeshStandardMaterial({ color: '#b39b62', metalness: .78, roughness: .34 });
  const brassDark = new THREE.MeshStandardMaterial({ color: '#51482e', metalness: .7, roughness: .65 });

  function block(w, h, d, x, y, z, material = paint, radius = .04, parent = group) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // The profile builds from the underside to the softly rounded upper lip.
  block(15.9, .19, 9.9, 0, -.27, 0, shadowPaint, .08);
  block(16.1, .12, 10.1, 0, -.17, 0, edgePaint, .055);
  block(16.19, .12, 10.19, 0, -.08, 0, paint, .055);
  block(16.12, .15, 10.12, 0, .04, 0, wood, .07);

  const topGeometry = new THREE.PlaneGeometry(15.96, 9.96);
  topGeometry.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(topGeometry, wood);
  top.position.y = DESK.surfaceY;
  top.receiveShadow = true;
  top.name = 'painted-wood-top';
  group.add(top);

  // Fine inset fillets: painted wood, with only the recess collecting patina.
  function rail(w, d, y, mat, thickness) {
    block(w, thickness, .035, 0, y, -d / 2, mat, .012);
    block(w, thickness, .035, 0, y, d / 2, mat, .012);
    block(.035, thickness, d, -w / 2, y, 0, mat, .012);
    block(.035, thickness, d, w / 2, y, 0, mat, .012);
  }
  rail(15.68, 9.68, .135, shadowPaint, .015);
  rail(15.73, 9.73, .145, paint, .035);
  rail(15.41, 9.41, .127, edgePaint, .012);

  // A solid frame with panelled drawer fronts. The interiors remain for later.
  block(15.5, .94, 9.47, 0, -.75, 0, shadowPaint, .06);
  block(15.52, .09, 9.51, 0, -1.19, 0, edgePaint, .035);
  const drawerWidths = [4.61, 5.25, 4.61];
  const drawerXs = [-5.02, 0, 5.02];
  for (let i = 0; i < 3; i++) {
    const x = drawerXs[i], w = drawerWidths[i];
    block(w, .74, .16, x, -.74, 4.785, wood, .035);
    block(w - .19, .56, .035, x, -.74, 4.878, shadowPaint, .035);
    block(w - .25, .50, .05, x, -.735, 4.896, paint, .035);
    block(w - .35, .40, .035, x, -.735, 4.925, wood, .03);
    makeHandle(x, -.69, 4.99);
  }
  // Small reeded stiles, with individual flutes catching the raking light.
  for (const x of [-7.54, -2.67, 2.67, 7.54]) {
    block(.17, .87, .13, x, -.74, 4.86, paint, .025);
    for (let j = -1; j <= 1; j++) block(.018, .62, .018, x + j * .043, -.74, 4.94, edgePaint, .008);
  }

  // Turned front legs give the visible underside an authentic furniture profile.
  const legPoints = [
    [.18, -3.35], [.20, -3.27], [.14, -3.16], [.12, -3.05],
    [.14, -2.8], [.18, -2.56], [.24, -2.37], [.26, -2.19],
    [.22, -2.03], [.17, -1.93], [.22, -1.83], [.23, -1.69],
    [.26, -1.59], [.26, -1.27],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const legGeometry = new THREE.LatheGeometry(legPoints, 40);
  for (const x of [-7.23, 7.23]) {
    for (const z of [-4.21, 4.21]) {
      const leg = new THREE.Mesh(legGeometry, paint);
      leg.position.set(x, 0, z);
      leg.castShadow = leg.receiveShadow = true;
      group.add(leg);
      for (const y of [-1.64, -1.88, -2.07, -3.24]) {
        const bead = new THREE.Mesh(new THREE.TorusGeometry(y < -3 ? .18 : .225, .018, 8, 40), edgePaint);
        bead.rotation.x = Math.PI / 2;
        bead.position.set(x, y, z);
        group.add(bead);
      }
    }
  }

  group.add(createCarvings(paint, edgePaint, shadowPaint));
  group.add(await createEmbossing(DESK.surfaceY));

  // Scattered rubbed paint on the front bullnose, deterministic and very small.
  let seed = 1901;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 125; i++) {
    const x = (random() - .5) * 15.8;
    block(.009 + random() ** 4 * .12, .006 + random() * .008, .006,
      x, -.115 + random() * .08, 5.095, i % 3 ? edgePaint : wornPaint, .002);
  }

  function makeHandle(x, y, z) {
    const assembly = new THREE.Group();
    assembly.position.set(x, y, z);
    group.add(assembly);
    const escutcheon = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), brass);
    escutcheon.scale.set(.25, .135, .024);
    assembly.add(escutcheon);
    const inset = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), brassDark);
    inset.scale.set(.21, .105, .025);
    inset.position.z = .008;
    assembly.add(inset);
    for (const side of [-1, 1]) {
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(.072, .08, .035, 24), brassLight);
      rose.rotation.x = Math.PI / 2;
      rose.position.set(side * .24, .005, .036);
      assembly.add(rose);
      const screw = new THREE.Mesh(new THREE.SphereGeometry(.026, 16, 8), brass);
      screw.scale.z = .5;
      screw.position.set(side * .24, .005, .063);
      assembly.add(screw);
      block(.029, .004, .004, side * .24, .005, .077, brassDark, .001, assembly);
    }
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.24, 0, .08), new THREE.Vector3(-.28, -.12, .18),
      new THREE.Vector3(-.16, -.21, .21), new THREE.Vector3(0, -.23, .22),
      new THREE.Vector3(.16, -.21, .21), new THREE.Vector3(.28, -.12, .18),
      new THREE.Vector3(.24, 0, .08),
    ]);
    const bail = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .027, 10, false), brassLight);
    bail.castShadow = true;
    assembly.add(bail);
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(.027, 20), brassDark);
    keyhole.position.set(0, 0, .032);
    assembly.add(keyhole);
    block(.025, .055, .003, 0, -.031, .033, brassDark, .003, assembly);
  }

  return { group, writingSurface, textures: [colorMap, bumpMap, roughnessMap] };
}

export function createEnvironment(renderer, scene) {
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = generator.fromScene(room, .045);
  scene.environment = environment.texture;
  scene.environmentIntensity = .36;
  room.dispose();
  generator.dispose();
  return environment;
}

// Soft, projected window and garden shadows are spatially attached to the desk.
// This avoids a screen-space overlay sliding across the furniture on camera moves.
export function createWindowShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1000;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 1600, 1000);
  context.save();
  context.translate(1060, 20);
  context.rotate(-.48);
  context.filter = 'blur(14px)';
  context.fillStyle = 'rgba(42, 48, 38, .23)';
  context.fillRect(-38, -500, 31, 1800);
  context.fillRect(340, -500, 23, 1800);
  context.fillRect(718, -500, 38, 1800);
  context.fillRect(-50, 210, 850, 26);
  context.fillRect(-50, 690, 850, 26);
  context.restore();
  // The soft, incomplete silhouette of leaves outside the window.
  context.filter = 'blur(20px)';
  context.fillStyle = 'rgba(41, 48, 35, .13)';
  let seed = 42;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 48; i++) {
    const x = 1320 + (random() - .5) * 480;
    const y = 120 + (random() - .5) * 680;
    context.beginPath();
    context.ellipse(x, y, 15 + random() * 25, 6 + random() * 12, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: .9, polygonOffset: true, polygonOffsetFactor: -1 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(15.95, 9.95), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = DESK.surfaceY + .008;
  shadow.renderOrder = 2;
  shadow.name = 'window-and-garden-shadow';
  return shadow;
}

export function createContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 32, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(38, 30, 19, .45)');
  gradient.addColorStop(.55, 'rgba(38, 30, 19, .23)');
  gradient.addColorStop(1, 'rgba(38, 30, 19, 0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(23, 15), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(.5, -3.45, .7);
  return mesh;
}
