// Convert the freely licensed, bundled TeX patterns into Hypher's compact
// format. Keep the original attribution, exceptions and complete MIT notice.
import { readFile, writeFile } from 'node:fs/promises';
const raw = await readFile(new URL('../public/licenses/hyph-en-gb.tex', import.meta.url), 'utf8');
const clean = raw.replace(/%[^\n]*/g, ''), patterns = {};
for (const token of clean.match(/\\patterns\{([\s\S]*?)\}/)[1].trim().split(/\s+/)) {
  const pattern = token.replaceAll('.', '_');
  patterns[pattern.length] = (patterns[pattern.length] || '') + pattern;
}
const exceptions = clean.match(/\\hyphenation\{([\s\S]*?)\}/)[1].trim().split(/\s+/).map(word => word.replaceAll('-', '‧')).join(',');
const data = { id: 'en-gb', leftmin: 2, rightmin: 3, exceptions, patterns };
await writeFile(new URL('../src/gazette-british-patterns.js', import.meta.url), '// British English patterns: Dominik Wujastyk and Graham Toal, MIT.\n// Converted from hyph-utf8; source and full notice: /licenses/hyph-en-gb.tex.\nexport default ' + JSON.stringify(data) + ';\n');
console.log('Converted British hyphenation patterns.');
