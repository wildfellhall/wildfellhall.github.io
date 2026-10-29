import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { parseGazette, paginateGazette, validDate, wrapText } from '../src/gazette-text.js';
import { gazetteCatalog } from '../scripts/gazette-catalog.mjs';
import { createGazetteGeometry, bendGazette, offsetGazetteLayer, GAZETTE_DEPTH } from '../src/gazette-geometry.js';
import { composePrintedText as composeGazetteText } from '../src/print-composition.js';
const published = await readFile(new URL('../public/gazette/issues/2026-10-29.txt', import.meta.url), 'utf8');
const template = await readFile(new URL('../public/gazette/template.txt', import.meta.url), 'utf8');
// Editorial changes belong in the published issue; deterministic pagination
// fixtures come from the blank template, not the user's evolving content.
const source = template.replace('date: YYYY-MM-DD', 'date: 2026-10-29')
  .replace(/^number:$/m, 'number: 1').replace(/^subtitle:\n/gm, '');

test('published issue parses and the editable template starts empty, with validated real dates', () => {
  const issue = parseGazette(published, '2026-10-29');
  assert.equal(issue.sections.length, 6);
  const empty = parseGazette(template.replace('date: YYYY-MM-DD', 'date: 2028-02-29'));
  assert.equal(empty.date, '2028-02-29');
  assert.ok(empty.sections.every(section => !section.title && !section.subtitle && !section.byline && !section.body));
  for (const date of ['2026-02-29', '2026-13-01', '2026-00-00', 'today', '0000-01-01']) assert.equal(validDate(date), false);
  assert.throws(() => parseGazette(source, '2026-10-30'), /filename/);
  assert.throws(() => parseGazette(source.replace('[article-2]', '[article-1]')), /repeated/);
  assert.throws(() => parseGazette(source.replace('[miscellaneous]', '[mistake]')), /Unknown/);
});

test('plain text accepts paragraphs, literal markup, and editorial metadata without leaking instructions', () => {
  const text = source.replace('[article-1]\ntitle:\nbyline:\n', '[article-1]\ntitle: A morning letter\nsubtitle: Notes from the reading room\nbyline: By A. Reader\n\nFirst paragraph: <script>literal</script>\nwrapped here.\n\nSecond paragraph.\n# An editing note\n');
  const issue = parseGazette(text.replaceAll('\n', '\r\n'));
  assert.equal(issue.sections[0].title, 'A morning letter');
  assert.equal(issue.sections[0].byline, 'By A. Reader');
  assert.equal(issue.sections[0].subtitle, 'Notes from the reading room');
  assert.match(issue.sections[0].body, /<script>literal<\/script>/);
  assert.doesNotMatch(issue.sections[0].body, /editing note/);
  assert.match(issue.sections[0].body, /\n\nSecond paragraph/);
});

test('long Gazette sections continue across sheets without losing words or splitting Unicode characters', () => {
  const issue = parseGazette(source), body = Array.from({length:1500}, (_, i) => `word${i}`).join(' ');
  issue.sections[0].body = body;
  const pages = paginateGazette(issue, s => Array.from(s).length * 12, s => s.length * 17);
  assert.ok(pages.length > 4);
  assert.equal(pages.flatMap(page => page.sections.filter(s => s.id === 'article-1').flatMap(s => s.lines)).join(' '), body);
  assert.equal(pages[1].sections[0].continued, true);
  const unicode = '𝔄é👩'.repeat(80);
  assert.equal(wrapText(unicode, 40, s => Array.from(s).length * 10).join(''), unicode);
});

test('British paragraph composition fits columns and preserves words across hyphenated continuations', () => {
  const paragraph = 'The morning correspondence continues with literary observations and descriptions of the neighbourhood.';
  const measure = text => Array.from(text).length * 11;
  const lines = composeGazetteText(`${paragraph}\n\n${paragraph}`, 205, measure);
  assert.equal(lines.filter(line => line.paragraphStart).length, 2);
  assert.equal(lines.filter(line => line.paragraphEnd).length, 2);
  assert.ok(lines.some(line => line.text.endsWith('-')), 'Narrow columns should use legal hyphenation points');
  const restored = lines.map(line => line.text.endsWith('-') ? line.text.slice(0, -1) : line.text + ' ').join('').trim();
  assert.equal(restored, `${paragraph} ${paragraph}`);
  for (const line of lines) for (const run of line.runs) {
    assert.ok(run.x >= 0 && run.x + run.width <= 205.05, 'Text must fit the actual column measure');
  }
  const token = '𝔄é👩'.repeat(90), emergency = composeGazetteText(token, 205, measure);
  assert.equal(emergency.map(line => line.text.replace(/-$/, '')).join(''), token);
  assert.ok(emergency.every(line => line.runs.every(run => run.x + run.width <= 205.05)));
  const issue = parseGazette(source); issue.sections[0].body = Array(250).fill(paragraph).join('\n\n');
  const pages = paginateGazette(issue, measure, measure, composeGazetteText);
  assert.ok(pages.length > 4);
  const continued = pages.flatMap(page => page.sections.filter(s => s.id === 'article-1').flatMap(s => s.columns.flat()));
  assert.equal(continued.filter(line => line.paragraphStart).length, 250, 'Pagination must retain paragraph indents');
  assert.equal(continued.filter(line => line.paragraphEnd).length, 250);
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
        assert.ok(a.y >= .0079, 'No part of the sheet can sink into the timber');
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


test('empty editions have four distinct pages with accurate contents and enough room for all headings', () => {
  const issue = parseGazette(source);
  const pages = paginateGazette(issue, s => s.length * 12, s => s.length * 19);
  assert.equal(pages.length, 4);
  assert.deepEqual(pages.map(p => p.sections.map(s => s.id)), [
    ['article-1', 'article-2'], ['article-3'], ['thought-a-day', 'words-of-the-week'], ['miscellaneous'],
  ]);
  assert.deepEqual(pages[0].contents.map(s => s.page), [1, 1, 2, 3, 3, 4]);
  assert.ok(pages.every(p => p.sections.every(s => !s.lines.length && s.bodyY < 1700)));
  issue.sections[0].subtitle = 'An editable subheading for a leading article';
  issue.sections[0].body = 'Words in an article. '.repeat(900);
  const expanded = paginateGazette(issue, s => s.length * 12, s => s.length * 19);
  assert.ok(expanded.length > 4);
  for (const page of expanded) for (const story of page.sections) {
    if (story.continues) assert.ok(expanded[story.nextPage - 1].sections.some(next => next.id === story.id && next.continued));
    if (story.continued) assert.ok(expanded[story.previousPage - 1].sections.some(previous => previous.id === story.id));
    assert.ok(story.columns.every(column => story.bodyY + column.length * 30 <= 1750));
  }
});

test('custom Gazette titles have separate space below section labels across wrapped and continued articles', () => {
  const issue = parseGazette(source);
  issue.sections[0].title = 'Objectives of Wildfell Gazette';
  issue.sections[0].subtitle = 'Correspondence from a quiet reading room';
  issue.sections[0].byline = 'Sanah Rajesh';
  issue.sections[0].body = 'The morning correspondence continues. '.repeat(600);
  issue.sections[4].title = 'Abstruse Natural Words and Observations from the Countryside';
  const pages = paginateGazette(issue, text => text.length * 12, text => text.length * 19, composeGazetteText);
  const stories = pages.flatMap(page => page.sections).filter(story => story.title);
  assert.ok(stories.some(story => story.continued));
  assert.ok(stories.some(story => story.titles.length > 1));
  for (const story of stories) {
    assert.ok(story.titleY - story.top - story.headline >= 28, 'The title needs clear air beneath its section label');
    const headerBottom = story.titleY + story.titles.length * (story.headline + 8)
      + story.subtitles.length * 32 + story.bylines.length * 30 + (story.continued ? 30 : 0);
    assert.ok(story.bodyY - headerBottom >= 20, 'Prose must begin below the complete heading block');
    assert.ok(story.columns.every(column => story.bodyY + column.length * 30 <= 1750));
  }
});

test('nested newspaper leaves keep their rounded-fold spacing and remain above the desk', () => {
  const base = createGazetteGeometry(), layers = Array.from({length:4}, () => base.clone());
  for (const progress of [0, .15, .5, .8, 1]) {
    bendGazette(base, progress);
    layers.forEach((layer, index) => offsetGazetteLayer(layer, base, index, progress));
    for (const layer of layers) {
      assert.ok(layer.attributes.position.array.every(Number.isFinite));
      assert.ok(layer.attributes.normal.array.every(Number.isFinite));
      for (let i = 0; i < layer.attributes.position.count; i++) assert.ok(layer.attributes.position.getY(i) > 0);
    }
    for (let index = 1; index < layers.length; index++) {
      const p = layers[index].attributes.position, q = layers[index - 1].attributes.position;
      for (let i = 0; i < p.count; i++) {
        const separation = new THREE.Vector3().fromBufferAttribute(p, i).sub(new THREE.Vector3().fromBufferAttribute(q, i));
        // Slips run along the local tangent; the normal component must
        // always leave air between the two paper surfaces.
        const normal = new THREE.Vector3().fromBufferAttribute(base.attributes.normal, i);
        assert.ok(separation.dot(normal) > .0055, 'Adjacent paper surfaces must not collapse into each other');
      }
      const mesh = new THREE.Mesh(layers[index], new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
      mesh.updateMatrixWorld();
      // Check the curved fold and broad overlapping faces: displaced cut
      // edges must not make the surfaces cross between their shifted grids.
      const rows = [...new Set([...Array.from({length:22}, (_, i) => 8 + i * 4),
        ...Array.from({length:9}, (_, i) => 43 + i * 2)])];
      // Stay inside the common overlap; the uneven side margins deliberately
      // extend beyond their neighbouring sheet.
      for (const row of rows) for (let col = 8; col <= 56; col += 8) {
        const i = row * 65 + col;
        const origin = new THREE.Vector3().fromBufferAttribute(q, i);
        const direction = new THREE.Vector3().fromBufferAttribute(layers[index - 1].attributes.normal, i);
        const hit = new THREE.Raycaster(origin, direction, 0, .15).intersectObject(mesh)[0];
        assert.ok(hit && hit.distance > .003, 'Overlapping paper surfaces must remain separated through the fold');
      }
      mesh.material.dispose();
    }
  }
});

test('resting cut edges expose multiple sheets, then settle into the open reading stack', () => {
  const base = createGazetteGeometry(), layers = Array.from({length:4}, () => base.clone());
  const edgeSpread = openness => {
    bendGazette(base, openness);
    layers.forEach((layer, index) => offsetGazetteLayer(layer, base, index, openness));
    // Measure the central cut edge at both ends, away from corner curls.
    return [0, 100].map(row => {
      const ends = layers.map(layer => layer.attributes.position.getZ(row * 65 + 32));
      return Math.max(...ends) - Math.min(...ends);
    });
  };
  const resting = edgeSpread(0), open = edgeSpread(1);
  assert.ok(resting.every(spread => spread > .20), 'Gathered leaves must expose a visible step at their cut edges');
  assert.ok(open.every(spread => spread < .07), 'The loose edge spread must settle when the newspaper opens');
  for (const layer of layers) layer.dispose();
  base.dispose();
});
