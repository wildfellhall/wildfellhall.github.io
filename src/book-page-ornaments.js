// Fine printed ornaments, drawn directly onto the paper's colour map. They
// share its fibres, lighting, curved surface and shadows rather than floating
// above it. The frame leaves a broad quiet margin around the type area.
export function drawPageOrnaments(ctx, width, height) {
  ctx.save(); ctx.strokeStyle = '#887056'; ctx.fillStyle = '#887056';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stroke = (path, weight = 1.35) => { ctx.lineWidth = weight; ctx.stroke(new Path2D(path)); };
  const leaf = (x, y, angle, length = 21) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-10, -length * .35, -8, -length * .85, 0, -length);
    ctx.bezierCurveTo(9, -length * .72, 8, -length * .3, 0, 0);
    ctx.lineWidth = 1; ctx.stroke();
    stroke(`M 0 0 Q -1 ${-length * .5} 0 ${-length}`, .8);
    ctx.restore();
  };
  const rose = (x, y, radius) => {
    ctx.save(); ctx.translate(x, y);
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate(i / 5 * Math.PI * 2 + ring * .55);
      const r = radius * (1 - ring * .26);
      stroke(`M ${-r * .5} ${-r * .35} C ${-r * 1.15} ${-r * 1.2} ${r * .8} ${-r * 1.25} ${r * .55} ${-r * .25}`, 1.1);
      ctx.restore();
    }
    stroke('M -2 0 Q -4 -6 2 -5 Q 7 0 0 3', 1.1); ctx.restore();
  };
  // Paired hairline rules stop short of the corner bouquets and centre tools.
  for (const inset of [62, 68]) {
    const gap = 115;
    stroke(`M ${inset} ${gap + 34} V ${height - gap - 34} M ${width - inset} ${gap + 34} V ${height - gap - 34}`, inset === 62 ? 1.45 : .65);
    stroke(`M 153 ${inset} H ${width / 2 - 100} M ${width / 2 + 100} ${inset} H ${width - 153}
      M 153 ${height - inset} H ${width / 2 - 100} M ${width / 2 + 100} ${height - inset} H ${width - 153}`, inset === 62 ? 1.45 : .65);
  }
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    ctx.save(); ctx.translate(sx === 1 ? 62 : width - 62, sy === 1 ? 62 : height - 62); ctx.scale(sx, sy);
    stroke('M 0 89 C 1 52 -8 7 24 4 C 52 1 55 35 34 38 C 16 40 15 21 27 20 C 35 20 35 28 30 29', 1.8);
    stroke('M 91 0 C 54 1 5 -7 4 24 C 3 52 35 55 38 34 C 40 16 21 15 20 27', 1.8);
    stroke('M 4 112 C 19 80 49 76 64 52 C 77 30 55 15 44 27 C 34 39 45 48 51 40', 1.3);
    stroke('M 112 4 C 80 19 76 49 52 64 C 30 77 15 55 27 44 C 39 34 48 45 40 51', 1.3);
    stroke('M 6 105 C 12 79 31 54 63 33 M 105 6 C 79 12 54 31 33 63', .8);
    for (const [x, y, a] of [[7, 89, .8], [17, 70, -.3], [37, 57, .8], [89, 7, -2.35], [70, 17, -1.25], [57, 37, -2.2]]) leaf(x, y, a, 18);
    rose(52, 52, 14); leaf(63, 62, 2.3, 17); leaf(62, 63, -.7, 17);
    ctx.restore();
  }
  for (const bottom of [false, true]) {
    ctx.save(); ctx.translate(width / 2, bottom ? height - 68 : 68); if (bottom) ctx.scale(1, -1);
    for (const sign of [1, -1]) {
      ctx.save(); ctx.scale(sign, 1);
      stroke('M 7 1 C 27 -16 50 22 73 9 C 92 -2 83 -24 68 -20 C 52 -16 62 0 70 -5', 1.5);
      stroke('M 18 8 C 40 29 71 35 97 16 M 26 1 C 42 -3 43 -24 56 -27', .95);
      leaf(36, 17, -.7, 19); leaf(51, 26, .45, 18); leaf(83, 24, 1, 17); leaf(45, -12, -.3, 15);
      ctx.restore();
    }
    rose(0, 0, 14); ctx.restore();
  }
  ctx.restore();
}
