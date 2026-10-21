import * as THREE from 'three';

// Shared profiles keep the carved relief seated on the actual timber surfaces.
export function desktopOutline(w, d) {
  const x = w / 2, z = d / 2, r = .30, s = new THREE.Shape();
  s.moveTo(-x + r, -z);
  s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r);
  s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
  s.bezierCurveTo(x * .65, z - .25, x * .35, z - .22, 0, z - .06);
  s.bezierCurveTo(-x * .35, z - .22, -x * .65, z - .25, -x + r, z);
  s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r);
  s.quadraticCurveTo(-x, -z, -x + r, -z);
  return s;
}

export function perimeterFrame(outline, t) {
  // Use the identical frame on both sides of the closed perimeter; a finite
  // tangent sampled at 1 can differ slightly from the one sampled at 0.
  const u = t === 1 ? 0 : t;
  const p = outline.getPointAt(u), tangent = outline.getTangentAt(u).normalize();
  return { p, tangent, outward: new THREE.Vector2(tangent.y, -tangent.x) };
}

export function legProfile(sx, sz) {
  const points = [[0, -1.35, 0], [.20, -2.08, .17], [.28, -2.75, .24], [.07, -3.65, .07], [-.08, -4.63, -.05], [.06, -5.42, .08], [.30, -5.79, .25], [.33, -5.90, .28], [.33, -5.99, .28]];
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(sx * (6.57 + x), y, sz * (2.77 + z))));
  const radii = [[-1.35, .31], [-2.08, .40], [-2.75, .28], [-3.65, .17], [-4.63, .115], [-5.42, .14], [-5.62, .17], [-5.82, .31], [-5.90, .28], [-5.99, .20]];
  function radius(t) {
    const y = curve.getPointAt(t).y;
    let i = 0;
    while (i < radii.length - 2 && y < radii[i + 1][0]) i++;
    const [ay, ar] = radii[i], [by, br] = radii[i + 1];
    return THREE.MathUtils.lerp(ar, br, THREE.MathUtils.smoothstep((ay - y) / (ay - by), 0, 1));
  }
  const rings = Array.from({ length: 193 }, (_, i) => {
    const t = i / 192, p = curve.getPointAt(t), down = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3(0, 0, sz).cross(down).normalize();
    const front = down.clone().cross(right).normalize();
    return { t, p, right, front, radius: radius(t) };
  });
  function surfaceBetween(a, b, f, angle, relief, target) {
    const r = THREE.MathUtils.lerp(a.radius, b.radius, f) + relief;
    const p = a.p.clone().lerp(b.p, f);
    const right = a.right.clone().lerp(b.right, f).normalize(), front = a.front.clone().lerp(b.front, f).normalize();
    const offset = right.multiplyScalar(Math.sin(angle) * r).addScaledVector(front, Math.cos(angle) * r);
    offset.z *= 1 + .18 * THREE.MathUtils.smoothstep(-p.y, 5.56, 5.82);
    target.copy(p).add(offset);
    target.y = THREE.MathUtils.clamp(target.y, -5.99, -1.57);
    return target;
  }
  function surface(t, angle, target) {
    const sample = t * (rings.length - 1), low = Math.min(rings.length - 2, Math.floor(sample));
    return surfaceBetween(rings[low], rings[low + 1], sample - low, angle, 0, target);
  }
  // Relief is authored in a flat local plane, then wrapped around the leg's
  // circular section. Its base intersects the wood, including along the ankle.
  function wrap(x, y, relief, target) {
    let low = 0, high = rings.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (rings[mid].p.y > y) low = mid; else high = mid;
    }
    const a = rings[low], b = rings[high], f = THREE.MathUtils.clamp((a.p.y - y) / (a.p.y - b.p.y), 0, 1);
    const r = THREE.MathUtils.lerp(a.radius, b.radius, f), angle = x / r;
    return surfaceBetween(a, b, f, angle, relief, target);
  }
  return { curve, radius, wrap, surface };
}

export function sweptMolding(outline, profile, segments = 480) {
  const positions = [], uv = [], bands = [[], []], count = profile.length;
  for (let i = 0; i <= segments; i++) {
    const { p, outward } = perimeterFrame(outline, i / segments);
    for (let j = 0; j < count; j++) {
      const [offset, y] = profile[j];
      positions.push(p.x + outward.x * offset, y, p.y + outward.y * offset);
      uv.push(i / segments * 8, j / (count - 1));
      if (i < segments && j < count - 1) {
        const a = i * count + j, b = a + count;
        bands[profile[j][2] || 0].push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(bands.flat());
  let start = 0;
  bands.forEach((indices, material) => { if (indices.length) geometry.addGroup(start, indices.length, material); start += indices.length; });
  geometry.computeVertexNormals();
  // The UV wrap duplicates the first perimeter row. Share its shading normal
  // with the last row so there is no vertical lighting line at that join.
  smoothPeriodicNormals(geometry, count, segments + 1, count, 1);
  return geometry;
}

export function smoothPeriodicNormals(geometry, rows, columns, columnStride = 1, rowStride = columns) {
  const normal = geometry.attributes.normal, average = new THREE.Vector3(), other = new THREE.Vector3();
  for (let row = 0; row < rows; row++) {
    const first = row * rowStride, last = first + (columns - 1) * columnStride;
    average.fromBufferAttribute(normal, first).add(other.fromBufferAttribute(normal, last)).normalize();
    normal.setXYZ(first, average.x, average.y, average.z); normal.setXYZ(last, average.x, average.y, average.z);
  }
}
