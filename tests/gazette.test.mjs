import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { parseGazette, paginateGazette, validDate, wrapText } from '../src/gazette-text.js';
import { gazetteCatalog } from '../scripts/gazette-catalog.mjs';
import { createGazetteGeometry, bendGazette, GAZETTE_DEPTH } from '../src/gazette-geometry.js';
const source = await readFile(new URL('../public/gazette/issues/2026-10-29.txt', import.meta.url), 'utf8');

test('first issue and template contain six empty editable sections, with a real date', async () => {
  const issue = parseGazette(source, '2026-10-29');
  assert.equal(issue.number, '1'); assert.equal(issue.sections.length, 6);
  assert.ok(issue.sections.every(section => !section.title && !section.byline && !section.body));
  const template = (await readFile(new URL('../public/gazette/template.txt', import.meta.url), 'utf8')).replace('date: YYYY-MM-DD', 'date: 2028-02-29');
  assert.equal(parseGazette(template).date, '2028-02-29');
  for (const date of ['2026-02-29', '2026-13-01', '2026-00-00', 'today', '0000-01-01']) assert.equal(validDate(date), false);
  assert.throws(() => parseGazette(source, '2026-10-30'), /filename/);
  assert.throws(() => parseGazette(source.replace('[article-2]', '[article-1]')), /repeated/);
  assert.throws(() => parseGazette(source.replace('[miscellaneous]', '[mistake]')), /Unknown/);
});

test('plain text accepts paragraphs, literal markup, and editorial metadata without leaking instructions', () => {
  const text = source.replace('[article-1]\ntitle:\nbyline:\n', '[article-1]\ntitle: A morning letter\nbyline: By A. Reader\n\nFirst paragraph: <script>literal</script>\nwrapped here.\n\nSecond paragraph.\n# An editing note\n');
  const issue = parseGazette(text.replaceAll('\n', '\r\n'));
  assert.equal(issue.sections[0].title, 'A morning letter');
  assert.equal(issue.sections[0].byline, 'By A. Reader');
  assert.match(issue.sections[0].body, /<script>literal<\/script>/);
  assert.doesNotMatch(issue.sections[0].body, /editing note/);
  assert.match(issue.sections[0].body, /\n\nSecond paragraph/);
});

test('long Gazette sections continue across sheets without losing words or splitting Unicode characters', () => {
  const issue = parseGazette(source), body = Array.from({length:1500}, (_, i) => `word${i}`).join(' ');
  issue.sections[0].body = body;
  const pages = paginateGazette(issue, s => Array.from(s).length * 12, s => s.length * 17);
  assert.ok(pages.length > 10);
  assert.equal(pages.flatMap(page => page.sections[0].lines).join(' '), body);
  assert.equal(pages[1].sections[0].continued, true);
  const unicode = '𝔄é👩'.repeat(80);
  assert.equal(wrapText(unicode, 40, s => Array.from(s).length * 10).join(''), unicode);
});

test('date catalog discovers new files, sorts newest first, and rejects mismatched or invalid issues', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wildfell-gazette-'));
  try {
    await writeFile(join(directory, '2026-10-29.txt'), source);
    await writeFile(join(directory, '2026-11-01.txt'), source.replaceAll('2026-10-29', '2026-11-01'));
    assert.deepEqual((await gazetteCatalog(directory)).map(entry => entry.date), ['2026-11-01', '2026-10-29']);
    await writeFile(join(directory, '2026-11-02.txt'), source);
    await assert.rejects(gazetteCatalog(directory), /2026-11-02.txt.*filename/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('loose newspaper fold remains a continuous length-preserving sheet above the desk', () => {
  const geometry = createGazetteGeometry(), p = geometry.attributes.position;
  for (const progress of [0, .12, .3, .5, .8, 1]) {
    bendGazette(geometry, progress);
    assert.ok(p.array.every(Number.isFinite)); assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
    for (let col = 0; col <= 64; col++) {
      let length = 0;
      for (let row = 0; row <= 100; row++) {
        const a = new THREE.Vector3().fromBufferAttribute(p, row * 65 + col);
        assert.ok(a.y >= .0219, 'No part of the sheet can sink into the timber');
        if (row) length += a.distanceTo(new THREE.Vector3().fromBufferAttribute(p, (row - 1) * 65 + col));
      }
      assert.ok(Math.abs(length - GAZETTE_DEPTH) < .015);
    }
    const edges = new Map();
    for (let i = 0; i < geometry.index.count; i += 3) {
      const ids = [0, 1, 2].map(j => geometry.index.getX(i + j));
      for (let j = 0; j < 3; j++) { const k = [ids[j], ids[(j + 1) % 3]].sort((a, b) => a - b).join(':'); edges.set(k, (edges.get(k) || 0) + 1); }
    }
    assert.equal([...edges.values()].filter(n => n === 1).length, 328, 'Only the outside boundary is open; the rounded fold has no seams');
    assert.ok([...edges.values()].every(n => n <= 2));
  }
});
