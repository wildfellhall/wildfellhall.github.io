// Outline the inscription locally so its copperplate strokes become real
// embossed geometry, independent of browser font loading and substitution.
// Imperial Script's looped capitals and connected shaded strokes:
// https://github.com/googlefonts/imperial-script
// Period context: https://www.regionalethnologyscotland.llc.ed.ac.uk/sites/default/files/scottish_handwriting_a_concise_guide.pdf
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';

const out = new URL('../public/ornaments/', import.meta.url);
await mkdir(out, { recursive: true });
const bytes = await readFile(new URL('../node_modules/@fontsource/imperial-script/files/imperial-script-latin-400-normal.woff', import.meta.url));
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const letters = font.getPath('Wildfell Hall', 0, 0, 160, { kerning: true });
const bounds = letters.getBoundingBox();
const name = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x1 - 3} ${bounds.y1 - 3} ${bounds.x2 - bounds.x1 + 6} ${bounds.y2 - bounds.y1 + 6}" fill="#ba8d36"><title>Wildfell Hall</title>${letters.toSVG({ flipY: false }).replace('fill="black"', '')}</svg>`;
await writeFile(new URL('wildfell-hall.svg', out), name);
await writeFile(new URL('imperial-script-OFL.txt', out), await readFile(new URL('../node_modules/@fontsource/imperial-script/LICENSE', import.meta.url)));
console.log('Built the looped copperplate inscription.');
