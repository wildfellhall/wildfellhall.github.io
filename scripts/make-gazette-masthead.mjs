// Original wordmark composition: OFL blackletter outlines with drawn pen
// flourishes. British masthead references and the face's American provenance
// are recorded in public/gazette/references.txt.
import { readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';
const bytes = await readFile(new URL('../src/assets/fonts/chomsky.otf', import.meta.url));
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const path = font.getPath('Wildfell Gazette', 0, 0, 150, { kerning: true });
const bounds = path.getBoundingBox(), scale = 1020 / (bounds.x2 - bounds.x1);
for (const command of path.commands) for (const key of ['x', 'x1', 'x2', 'y', 'y1', 'y2']) {
  if (command[key] === undefined) continue;
  command[key] = key.startsWith('x') ? (command[key] - bounds.x1) * scale + 80
    : (command[key] - bounds.y1) * scale + 30;
}
const flourish = 'M92 35C57 7 33 29 49 48C58 59 76 46 63 39M100 133C76 147 42 154 25 137C16 126 28 119 37 126M1090 133C1120 152 1155 145 1154 128C1153 115 1137 117 1139 127M1117 36C1148 15 1170 39 1150 51';
await writeFile(new URL('../public/ornaments/gazette-masthead.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1180 180"><title>Wildfell Gazette</title><g fill="#111111">${path.toSVG({flipY:false})}</g><path d="${flourish}" fill="none" stroke="#111111" stroke-width="1.5" stroke-linecap="round"/></svg>`);
console.log('Built the Gazette masthead outlines.');
