// Locally outlined Roman lettering: the browser renders gold geometry, not a
// substituted system font. The font remains a build-time dependency only.
import { readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';

const bytes = await readFile(new URL('../node_modules/@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff', import.meta.url));
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const paths = [];
for (const [text, y, width] of [['THE TENANT', 0, 180], ['OF', 38, 29], ['WILDFELL', 80, 163], ['HALL', 124, 91]]) {
  const path = font.getPath(text, 0, 0, 100, { kerning: true });
  const bounds = path.getBoundingBox(), scale = width / (bounds.x2 - bounds.x1);
  for (const command of path.commands) for (const key of ['x', 'x1', 'x2', 'y', 'y1', 'y2']) {
    if (command[key] === undefined) continue;
    command[key] = key.startsWith('x') ? (command[key] - (bounds.x1 + bounds.x2) / 2) * scale
      : (command[key] - (bounds.y1 + bounds.y2) / 2) * scale + y;
  }
  paths.push(path.toSVG({ flipY: false }));
}
await writeFile(new URL('../public/ornaments/tenant-title.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -20 200 165"><title>The Tenant of Wildfell Hall</title>${paths.join('')}</svg>`);
await writeFile(new URL('../public/ornaments/libre-baskerville-OFL.txt', import.meta.url), await readFile(new URL('../node_modules/@fontsource/libre-baskerville/LICENSE', import.meta.url)));
console.log('Built the gilt book title.');
