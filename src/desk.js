import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCarvings, createEmbossing } from './ornaments.js';

export const DESK = Object.freeze({ width: 15.2, depth: 7.6, surfaceY: .203, floorY: -6.08 });

// A shaped, softly serpentine outline for the layered solid-wood top.
function topOutline(w, d) {
  const x = w / 2, z = d / 2, r = .30;
  const s = new THREE.Shape();
  s.moveTo(-x + r, -z);
  s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r);
  s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
  s.bezierCurveTo(x * .65, z - .25, x * .35, z - .22, 0, z - .06);
  s.bezierCurveTo(-x * .35, z - .22, -x * .65, z - .25, -x + r, z);
  s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r);
  s.quadraticCurveTo(-x, -z, -x + r, -z);
  return s;
}

export async function createDesk(renderer) {
  const group = new THREE.Group(); group.name = 'carved-antique-ivory-writing-desk';
  const writingSurface = new THREE.Group(); writingSurface.position.y = DESK.surfaceY;
  writingSurface.name = 'writing-surface-objects'; group.add(writingSurface);
  const loader = new THREE.TextureLoader();
  const [colorMap, bumpMap, roughnessMap] = await Promise.all(['ivory-color', 'ivory-height', 'ivory-roughness'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}materials/${name}.webp`)));
  colorMap.colorSpace = THREE.SRGBColorSpace;
  for (const t of [colorMap, bumpMap, roughnessMap]) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const paint = new THREE.MeshStandardMaterial({ color: '#e6e0d2', roughness: .64, bumpMap, bumpScale: .009 });
  const edge = new THREE.MeshStandardMaterial({ color: '#d6cdbb', roughness: .60 });
  const recess = new THREE.MeshStandardMaterial({ color: '#a79b86', roughness: .88 });
  const panel = new THREE.MeshStandardMaterial({ color: '#dbd4c5', roughness: .72, bumpMap, bumpScale: .012 });
  const wood = new THREE.MeshStandardMaterial({ map: colorMap, bumpMap, bumpScale: .016, roughnessMap, roughness: .76, color: '#f8f5ed' });
  const brass = new THREE.MeshStandardMaterial({ color: '#9c7844', metalness: .84, roughness: .39 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#655239', metalness: .73, roughness: .58 });
  const porcelain = new THREE.MeshPhysicalMaterial({ color: '#e9e2d4', roughness: .24, clearcoat: .55, clearcoatRoughness: .27 });
  function mesh(geometry, material, x = 0, y = 0, z = 0, parent = group) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function block(w, h, d, x, y, z, material = paint, radius = .04) {
    return mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material, x, y, z);
  }
  function top(w, d, y, thickness, bevel, material) {
    const g = new THREE.ExtrudeGeometry(topOutline(w, d), {
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
  top(14.90, 7.30, -.27, .10, .035, edge);
  top(15.16, 7.57, -.15, .10, .045, paint);
  top(15.28, 7.67, -.015, .11, .055, edge);
  top(15.18, 7.57, .175, .15, .028, [wood, paint]);

  // A deeper frieze and separate fronts make the drawer joints legible.
  block(14.48, 1.28, 6.42, 0, -.98, 0, recess);
  block(14.60, .10, 6.54, 0, -.36, 0, edge);
  block(14.52, .12, 6.50, 0, -1.61, 0, paint);
  const drawers = [{ x: -4.82, w: 4.45 }, { x: 0, w: 4.80 }, { x: 4.82, w: 4.45 }];
  for (const { x, w } of drawers) {
    block(w, 1.13, .15, x, -.96, 3.29, paint, .055).name = 'drawer-front';
    block(w - .19, .94, .055, x, -.96, 3.385, edge, .07);
    block(w - .28, .84, .058, x, -.96, 3.423, paint, .065);
    block(w - .39, .73, .018, x, -.96, 3.458, panel, .065);
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
    const points = [[0, -1.35, 0], [.20, -2.08, .17], [.28, -2.75, .24], [.07, -3.65, .07], [-.08, -4.63, -.05], [.06, -5.42, .08], [.30, -5.79, .25]];
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(sx * (6.57 + x), y, sz * (2.77 + z))));
    const g = taperedLeg(curve, [.31, .40, .28, .17, .115, .14, .21]);
    mesh(g, paint);
    const foot = mesh(new THREE.SphereGeometry(1, 24, 16), paint, sx * 6.90, -5.83, sz * 3.04);
    foot.scale.set(.30, .16, .38);
    const sole = mesh(new THREE.SphereGeometry(1, 24, 12), edge, sx * 6.91, -5.96, sz * 3.06);
    sole.scale.set(.29, .035, .36);
  }

  // Ivory porcelain cabinet knobs seated in chased brass rosettes.
  function knob(x, y) {
    const z = 3.51;
    const plate = mesh(new THREE.SphereGeometry(1, 32, 20), bronze, x, y, z);
    plate.scale.set(.23, .25, .038);
    const ring = mesh(new THREE.TorusGeometry(.19, .018, 10, 36), brass, x, y, z + .035);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const petal = mesh(new THREE.SphereGeometry(1, 12, 8), brass, x + Math.sin(a) * .17, y + Math.cos(a) * .17, z + .047);
      petal.scale.set(.035, .048, .02); petal.rotation.z = -a;
    }
    const neck = mesh(new THREE.CylinderGeometry(.067, .085, .16, 24), brass, x, y, z + .12); neck.rotation.x = Math.PI / 2;
    const bulb = mesh(new THREE.SphereGeometry(1, 32, 24), porcelain, x, y, z + .24); bulb.scale.set(.155, .16, .115);
    mesh(new THREE.TorusGeometry(.15, .012, 8, 32), brass, x, y, z + .245);
    const face = mesh(new THREE.SphereGeometry(.024, 12, 8), brass, x, y, z + .354); face.scale.z = .5;
  }
  for (const x of [-4.82, -1.34, 1.34, 4.82]) knob(x, -.93);
  const keyplate = mesh(new THREE.SphereGeometry(1, 24, 16), brass, 0, -1.30, 3.50); keyplate.scale.set(.09, .13, .018);
  mesh(new THREE.CircleGeometry(.025, 16), bronze, 0, -1.27, 3.522);
  block(.025, .065, .006, 0, -1.31, 3.524, bronze, .004);
  group.add(createCarvings(paint, edge, recess), await createEmbossing(DESK.surfaceY));
  return { group, writingSurface };
}

function taperedLeg(curve, radii) {
  const lengthSegments = 72, radialSegments = 20;
  const frames = curve.computeFrenetFrames(lengthSegments, false), positions = [], uv = [], indices = [];
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments, p = curve.getPointAt(t), f = t * (radii.length - 1), a = Math.min(radii.length - 2, Math.floor(f));
    const u = THREE.MathUtils.smoothstep(f - a, 0, 1), r = THREE.MathUtils.lerp(radii[a], radii[a + 1], u);
    for (let j = 0; j <= radialSegments; j++) {
      const theta = j / radialSegments * Math.PI * 2;
      const offset = frames.normals[i].clone().multiplyScalar(Math.cos(theta) * r).addScaledVector(frames.binormals[i], Math.sin(theta) * r);
      positions.push(p.x + offset.x, p.y + offset.y, p.z + offset.z); uv.push(j / radialSegments, t);
      if (i < lengthSegments && j < radialSegments) {
        const a = i * (radialSegments + 1) + j, b = a + radialSegments + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function createEnvironment(renderer, scene) {
  const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const result = generator.fromScene(room, .08);
  scene.environment = result.texture; scene.environmentIntensity = .30;
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
