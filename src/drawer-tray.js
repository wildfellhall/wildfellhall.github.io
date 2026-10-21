import * as THREE from 'three';

// A single closed shell: uninterrupted floor, coved inside corners, rounded
// rim, outer walls and underside. There are no overlapping board edges.
export function drawerTray(width, depth = 5.90) {
  const floor = -1.36, bottom = -1.46, top = -.55, wall = .14;
  const cove = .065, lip = .014, corner = .26, arcSteps = 16;
  const profile = [];
  for (let i = 0; i <= 10; i++) {
    const a = i / 10 * Math.PI / 2;
    profile.push([wall + cove - cove * Math.sin(a), floor + cove - cove * Math.cos(a)]);
  }
  profile.push([wall, top - lip]);
  for (let i = 1; i <= 6; i++) {
    const a = i / 6 * Math.PI / 2;
    profile.push([wall - lip + lip * Math.cos(a), top - lip + lip * Math.sin(a)]);
  }
  profile.push([lip, top]);
  for (let i = 1; i <= 6; i++) {
    const a = i / 6 * Math.PI / 2;
    profile.push([lip - lip * Math.sin(a), top - lip + lip * Math.cos(a)]);
  }
  profile.push([0, bottom + lip]);
  for (let i = 1; i <= 6; i++) {
    const a = i / 6 * Math.PI / 2;
    profile.push([lip - lip * Math.cos(a), bottom + lip - lip * Math.sin(a)]);
  }
  const outline = [];
  for (let cornerIndex = 0; cornerIndex < 4; cornerIndex++) {
    const sx = cornerIndex < 2 ? 1 : -1, sz = cornerIndex === 0 || cornerIndex === 3 ? 1 : -1;
    for (let i = 0; i <= arcSteps; i++) {
      const angle = -cornerIndex * Math.PI / 2 + Math.PI / 2 - i / arcSteps * Math.PI / 2;
      outline.push({ x: sx * (width / 2 - corner), z: sz * (depth / 2 - corner), nx: Math.cos(angle), nz: Math.sin(angle) });
    }
  }
  const positions = [], normals = [], uv = [], indices = [], count = outline.length;
  profile.forEach(([offset, y], row) => {
    const previous = profile[Math.max(0, row - 1)], next = profile[Math.min(profile.length - 1, row + 1)];
    const slope = new THREE.Vector2(-(next[1] - previous[1]), -(next[0] - previous[0])).normalize();
    if (row === 0) slope.set(0, 1);
    if (row === profile.length - 1) slope.set(0, -1);
    outline.forEach(({ x, z, nx, nz }, column) => {
      const px = x + nx * (corner - offset), pz = z + nz * (corner - offset);
      positions.push(px, y, pz); normals.push(nx * slope.x, slope.y, nz * slope.x); uv.push(px / 6.4 + .5, pz / 6.4 + .5);
      if (row < profile.length - 1) {
        const a = row * count + column, b = row * count + (column + 1) % count, c = a + count, d = b + count;
        indices.push(a, c, b, b, c, d);
      }
    });
  });
  for (const [row, y, sign] of [[0, floor, 1], [profile.length - 1, bottom, -1]]) {
    const center = positions.length / 3;
    positions.push(0, y, 0); normals.push(0, sign, 0); uv.push(.5, .5);
    for (let i = 0; i < count; i++) {
      const a = row * count + i, b = row * count + (i + 1) % count;
      indices.push(...(sign > 0 ? [center, a, b] : [center, b, a]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return geometry;
}
