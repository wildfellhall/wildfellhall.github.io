import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCarvings, createEmbossing } from './ornaments.js';
import { desktopOutline, legProfile, sweptMolding, smoothPeriodicNormals } from './furniture-profiles.js';
import { drawerTray } from './drawer-tray.js';
import { continuousWood, applyWoodCoordinates } from './wood-finish.js';

export const DESK = Object.freeze({ width: 15.2, depth: 7.6, surfaceY: .203, floorY: -6.08 });

export async function createDesk(renderer) {
  const group = new THREE.Group(); group.name = 'carved-antique-ivory-writing-desk';
  const writingSurface = new THREE.Group(); writingSurface.position.y = DESK.surfaceY;
  writingSurface.name = 'writing-surface-objects'; group.add(writingSurface);
  const loader = new THREE.TextureLoader();
  const [[colorMap, bumpMap, roughnessMap], [drawerColor, drawerHeight, drawerRoughness]] = await Promise.all([
    Promise.all(['ivory-color', 'ivory-height', 'ivory-roughness'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}materials/${name}.webp?v=relief-4`))),
    Promise.all(['color', 'height', 'roughness'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}materials/drawer-ivory-${name}.webp?v=relief-2`))),
  ]);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  drawerColor.colorSpace = THREE.SRGBColorSpace;
  for (const t of [colorMap, bumpMap, roughnessMap, drawerColor, drawerHeight, drawerRoughness]) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  for (const t of [colorMap, bumpMap, roughnessMap, drawerColor, drawerHeight, drawerRoughness]) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  const painted = (color, roughness, bumpScale) => continuousWood(new THREE.MeshStandardMaterial({ color, map: colorMap, roughnessMap, roughness, bumpMap, bumpScale }), 18);
  const paint = painted('#fffdf8', .87, .007);
  const edge = painted('#f1ebdf', .85, .004);
  const polishedEdge = painted('#fffdf8', .73, .004);
  const recess = new THREE.MeshStandardMaterial({ color: '#a79b86', roughness: .88 });
  const panel = painted('#fffdf8', .89, .009);
  const wood = painted('#fffdf8', .85, .012);
  const drawerWood = continuousWood(new THREE.MeshStandardMaterial({ map: drawerColor, color: '#ffffff', bumpMap: drawerHeight, bumpScale: .008, roughnessMap: drawerRoughness, roughness: .91 }));
  drawerWood.userData.localWood = true;
  const brass = new THREE.MeshStandardMaterial({ color: '#9c7844', metalness: .84, roughness: .39 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#655239', metalness: .73, roughness: .58 });
  const porcelain = new THREE.MeshPhysicalMaterial({ color: '#e9e2d4', roughness: .24, clearcoat: .55, clearcoatRoughness: .27 });
  function mesh(geometry, material, x = 0, y = 0, z = 0, parent = group) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function block(w, h, d, x, y, z, material = paint, radius = .04, parent = group) {
    return mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material, x, y, z, parent);
  }
  function top(w, d, y, thickness, bevel, material) {
    const g = new THREE.ExtrudeGeometry(desktopOutline(w, d), {
      depth: thickness, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 32,
      UVGenerator: {
        generateTopUV(geometry, vertices, a, b, c) {
          return [a, b, c].map(i => new THREE.Vector2(vertices[i * 3] / w + .5, vertices[i * 3 + 1] / d + .5));
        },
        generateSideWallUV(geometry, vertices, a, b, c, d) {
          return [a, b, c, d].map(i => new THREE.Vector2(vertices[i * 3] * .15, vertices[i * 3 + 2]));
        },
      },
    });
    g.rotateX(Math.PI / 2);
    return mesh(g, material, 0, y, 0);
  }
  top(14.90, 7.30, -.27, .10, .025, edge);
  // An ovolo lip, concave cove, projecting bead and recessed lower fillet.
  // Real profile changes produce the highlight/shadow lines around the edge.
  mesh(sweptMolding(desktopOutline(15.18, 7.57), [
    [-.018, .177], [.010, .168], [.031, .145], [.040, .115], [.035, .085],
    [.017, .055], [-.014, .032], [-.031, .008], [-.036, -.018], [-.026, -.044],
    [-.002, -.063], [.034, -.080], [.054, -.104], [.058, -.132], [.047, -.157],
    [.022, -.177], [-.014, -.188], [-.049, -.190, 1], [-.055, -.206, 1], [-.055, -.295, 1],
    [-.068, -.313], [-.100, -.326], [-.136, -.330], [-.145, -.350],
  ]), [polishedEdge, edge]).name = 'ogee-and-ovolo-edge-molding';
  top(15.18, 7.57, .175, .15, .028, [wood, paint]);

  // Hollow drawer bays, a back board and separate runners let the actual
  // wooden boxes slide out from beneath the top.
  block(14.48, 1.28, .16, 0, -.98, -3.13, recess);
  block(14.60, .10, 6.54, 0, -.36, 0, edge);
  block(14.52, .12, 6.50, 0, -1.61, 0, paint);
  for (const x of [-2.43, 2.43]) block(.14, 1.16, 6.25, x, -.98, 0, recess, .02);
  const drawers = [{ x: -4.82, w: 4.45 }, { x: 0, w: 4.80 }, { x: 4.82, w: 4.45 }].map((spec, index) => {
    const moving = new THREE.Group();
    moving.name = `${['left', 'centre', 'right'][index]}-drawer`;
    moving.userData.drawerIndex = index; group.add(moving);
    return { ...spec, group: moving, open: false, travel: 2.65 };
  });
  for (const { x, w, group: moving } of drawers) {
    block(w, 1.13, .15, x, -.96, 3.29, paint, .055, moving).name = 'drawer-front';
    block(w - .19, .94, .055, x, -.96, 3.385, edge, .07, moving);
    block(w - .28, .84, .058, x, -.96, 3.423, paint, .065, moving);
    block(w - .39, .73, .018, x, -.96, 3.458, panel, .065, moving);
    mesh(drawerTray(w - .32), drawerWood, x, 0, .28, moving).name = 'continuous-ivory-drawer-interior';
    for (const side of [-1, 1]) {
      const wallX = x + side * (w / 2 - .24);
      block(.20, .08, 5.95, wallX, -1.50, .10, recess, .01);
    }
  }
  for (const x of [-7.16, -2.43, 2.43, 7.16]) {
    block(.16, 1.24, .24, x, -.97, 3.32, edge, .025);
    for (let i = -1; i <= 1; i++) block(.018, .98, .025, x + i * .043, -.97, 3.455, paint, .008);
  }

  // Shaped apron: scallops are cut into its silhouette and have a carved edge.
  const apron = new THREE.Shape();
  apron.moveTo(-7.23, -1.50); apron.lineTo(7.23, -1.50);
  apron.bezierCurveTo(7.2, -2.22, 6.80, -2.33, 6.15, -1.95);
  apron.bezierCurveTo(5.25, -2.09, 4.2, -2.22, 3.22, -1.78);
  apron.bezierCurveTo(1.65, -1.75, 1.01, -2.36, 0, -2.43);
  apron.bezierCurveTo(-1.01, -2.36, -1.65, -1.75, -3.22, -1.78);
  apron.bezierCurveTo(-4.2, -2.22, -5.25, -2.09, -6.15, -1.95);
  apron.bezierCurveTo(-6.8, -2.33, -7.2, -2.22, -7.23, -1.50);
  mesh(new THREE.ExtrudeGeometry(apron, { depth: .16, bevelEnabled: true, bevelSize: .045, bevelThickness: .035, bevelSegments: 3, curveSegments: 20 }), paint, 0, 0, 3.17);
  for (const side of [-1, 1]) {
    block(.20, 1.23, 6.40, side * 7.12, -.98, 0, panel);
    const sideApron = new THREE.Shape();
    sideApron.moveTo(-3.2, -1.48); sideApron.lineTo(3.2, -1.48);
    sideApron.bezierCurveTo(2.8, -2.05, 2.0, -1.94, 1.4, -1.78);
    sideApron.quadraticCurveTo(0, -2.22, -1.4, -1.78);
    sideApron.bezierCurveTo(-2.0, -1.94, -2.8, -2.05, -3.2, -1.48);
    const g = new THREE.ExtrudeGeometry(sideApron, { depth: .12, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 3, curveSegments: 20 });
    g.rotateY(side * Math.PI / 2); mesh(g, paint, side * 7.02, 0, 0);
  }

  // Continuous cabriole legs: swollen knees, swept ankles and small scroll feet.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const profile = legProfile(sx, sz);
    const g = taperedLeg(profile);
    mesh(g, paint).name = 'continuous-cabriole-leg-and-scroll-foot';
  }

  // Ivory porcelain cabinet knobs seated in chased brass rosettes.
  function knob(x, y, parent) {
    const z = 3.51;
    const hardware = new THREE.Group(); parent.add(hardware);
    const part = (geometry, material, px, py, pz) => mesh(geometry, material, px, py, pz, hardware);
    const plate = part(new THREE.SphereGeometry(1, 32, 20), bronze, x, y, z);
    plate.scale.set(.23, .25, .038);
    part(new THREE.TorusGeometry(.19, .018, 10, 36), brass, x, y, z + .035);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const petal = part(new THREE.SphereGeometry(1, 12, 8), brass, x + Math.sin(a) * .17, y + Math.cos(a) * .17, z + .047);
      petal.scale.set(.035, .048, .02); petal.rotation.z = -a;
    }
    const neck = part(new THREE.CylinderGeometry(.067, .085, .16, 24), brass, x, y, z + .12); neck.rotation.x = Math.PI / 2;
    const bulb = part(new THREE.SphereGeometry(1, 32, 24), porcelain, x, y, z + .24); bulb.scale.set(.185, .18, .135);
    part(new THREE.TorusGeometry(.175, .012, 8, 32), brass, x, y, z + .245);
    const face = part(new THREE.SphereGeometry(.024, 12, 8), brass, x, y, z + .374); face.scale.z = .5;
  }
  for (const [i, xs] of [[0, [-4.82]], [1, [-1.34, 1.34]], [2, [4.82]]]) {
    for (const x of xs) knob(x, -.93, drawers[i].group);
  }
  const centre = drawers[1].group;
  const keyplate = mesh(new THREE.SphereGeometry(1, 24, 16), brass, 0, -1.30, 3.50, centre); keyplate.scale.set(.09, .13, .018);
  mesh(new THREE.CircleGeometry(.025, 16), bronze, 0, -1.27, 3.522, centre);
  block(.025, .065, .006, 0, -1.31, 3.524, bronze, .004, centre);
  group.add(createCarvings(paint, edge, recess, drawers.map(drawer => drawer.group)), await createEmbossing(DESK.surfaceY, brass, renderer));
  applyWoodCoordinates(group);
  return { group, writingSurface, drawers };
}

function taperedLeg({ surface }) {
  const lengthSegments = 192, radialSegments = 64;
  const positions = [], uv = [], indices = [], point = new THREE.Vector3();
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments;
    for (let j = 0; j <= radialSegments; j++) {
      const theta = j / radialSegments * Math.PI * 2;
      surface(t, theta, point);
      positions.push(point.x, point.y, point.z); uv.push(j / radialSegments, t);
      if (i < lengthSegments && j < radialSegments) {
        const a = i * (radialSegments + 1) + j, b = a + radialSegments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  // Close the timber at the apron and underneath the foot. The foot grows
  // from the same surface as the ankle instead of intersecting a separate ball.
  for (const [row, sign] of [[0, 1], [lengthSegments, -1]]) {
    const start = row * (radialSegments + 1), center = positions.length / 3;
    const p = new THREE.Vector3();
    for (let j = 0; j < radialSegments; j++) p.add(new THREE.Vector3().fromArray(positions, (start + j) * 3));
    p.divideScalar(radialSegments); positions.push(p.x, p.y, p.z); uv.push(.5, .5);
    for (let j = 0; j < radialSegments; j++) indices.push(...(sign > 0 ? [center, start + j, start + j + 1] : [center, start + j + 1, start + j]));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  smoothPeriodicNormals(geometry, lengthSegments + 1, radialSegments + 1);
  return geometry;
}

export function createEnvironment(renderer, scene) {
  const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const result = generator.fromScene(room, .08);
  scene.environment = result.texture; scene.environmentIntensity = .20;
  room.dispose(); generator.dispose(); return result;
}

export function createFloor() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a68d70'; ctx.fillRect(0, 0, 1024, 1024);
  let seed = 1847; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let plank = 0; plank < 8; plank++) {
    const tint = 145 + random() * 15;
    ctx.fillStyle = `rgb(${tint + 16} ${tint - 2} ${tint - 26})`; ctx.fillRect(plank * 128, 0, 128, 1024);
    ctx.fillStyle = '#4d3d2e40'; ctx.fillRect(plank * 128, 0, 1.8, 1024);
    for (let i = 0; i < 75; i++) {
      const x = plank * 128 + random() * 128;
      ctx.strokeStyle = `rgba(62,43,25,${.008 + random() * .035})`; ctx.lineWidth = .3 + random() * 1.4;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 12, 260, x - 8, 730, x + 4, 1024); ctx.stroke();
    }
    const seam = (plank % 3) * 330 + 120;
    ctx.fillStyle = '#4d3d2e35'; ctx.fillRect(plank * 128, seam, 128, 1.5);
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(60, 60); map.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ map, color: '#b1a18d', roughness: .88 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = DESK.floorY; floor.receiveShadow = true;
  return floor;
}
