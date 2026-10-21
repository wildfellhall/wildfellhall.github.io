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
  const p = outline.getPointAt(t), tangent = outline.getTangentAt(t).normalize();
  return { p, tangent, outward: new THREE.Vector2(tangent.y, -tangent.x) };
}

export function legProfile(sx, sz) {
  const points = [[0, -1.35, 0], [.20, -2.08, .17], [.28, -2.75, .24], [.07, -3.65, .07], [-.08, -4.63, -.05], [.06, -5.42, .08], [.30, -5.79, .25]];
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(sx * (6.57 + x), y, sz * (2.77 + z))));
  const radii = [.31, .40, .28, .17, .115, .14, .21];
  function radius(t) {
    const f = THREE.MathUtils.clamp(t, 0, 1) * (radii.length - 1), a = Math.min(radii.length - 2, Math.floor(f));
    return THREE.MathUtils.lerp(radii[a], radii[a + 1], THREE.MathUtils.smoothstep(f - a, 0, 1));
  }
  const rings = Array.from({ length: 129 }, (_, i) => {
    const t = i / 128, p = curve.getPointAt(t), down = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3(0, 0, sz).cross(down).normalize();
    const front = down.clone().cross(right).normalize();
    return { t, p, right, front, radius: radius(t) };
  });
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
    const right = a.right.clone().lerp(b.right, f).normalize(), front = a.front.clone().lerp(b.front, f).normalize();
    target.copy(a.p).lerp(b.p, f).addScaledVector(right, Math.sin(angle) * (r + relief))
      .addScaledVector(front, Math.cos(angle) * (r + relief));
    return target;
  }
  return { curve, radius, wrap };
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
  return geometry;
}
