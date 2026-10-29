import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE, parseBookText, paginateBookText, pageFaces } from '../src/book-text.js';
import { BookMotion } from '../src/book-motion.js';

const measure = text => Array.from(text).length * 17;
test('plain text accepts editor line endings, notes, paragraphs and explicit page breaks', () => {
  assert.deepEqual(parseBookText('\uFEFF# Instructions\r\nFirst line\r\nwrapped line.\r\n\r\nSecond paragraph.\r\n---\r\nNext page.'), [
    { type: 'paragraph', text: 'First line wrapped line.' },
    { type: 'paragraph', text: 'Second paragraph.' }, { type: 'break' },
    { type: 'paragraph', text: 'Next page.' },
  ]);
  const pages = paginateBookText('First.\n---\nSecond.\n---\n---\nFourth.', measure);
  assert.deepEqual(pages.map(p => p.text), ['First.', 'Second.', '', 'Fourth.']);
  assert.equal(paginateBookText('# Only instructions\n', measure)[0].text, '');
});

test('long prose flows without loss, overprinting the border, or a fixed page limit', () => {
  const source = Array.from({ length: 360 }, (_, i) => `Paragraph ${i}: ${'The quiet room overlooked the garden. '.repeat(7)}`).join('\n\n');
  const pages = paginateBookText(source, measure);
  assert.ok(pages.length > 96, 'A long manuscript must grow past the original blank leaves');
  assert.equal(pages.map(p => p.text).join('').replace(/\s/g, ''), source.replace(/\s/g, ''));
  for (const page of pages) {
    assert.ok(page.lines.length <= TYPE.lines);
    for (const line of page.lines) {
      assert.ok(line.runs.every(run => run.x >= 0 && TYPE.left + run.x + run.width <= TYPE.right + .05));
      assert.ok(line.y <= 1245, 'Text stays inside the lower scrollwork');
    }
  }
  const motion = new BookMotion(Math.ceil(pages.length / 2)); motion.open(); motion.step(0, true);
  while (motion.turn(1)) motion.step(0, true);
  assert.equal(motion.page, Math.ceil(pages.length / 2));
  assert.equal(motion.turn(1), false); assert.equal(motion.turn(-1), true);
});

test('long unbroken Unicode words wrap without dropping characters or interpreting markup', () => {
  const source = `Été — ${'éλЖ'.repeat(1000)}\n\n<script>alert("literal text")</script>`;
  const pages = paginateBookText(source, measure);
  assert.equal(pages.map(p => p.text).join('').replace(/\s/g, ''), source.replace(/\s/g, ''));
  assert.ok(pages.every(p => p.lines.every(line => line.runs.every(run => TYPE.left + run.x + run.width <= TYPE.right + .05))));
});

test('book composition justifies interior lines while preserving literal and discretionary hyphens', () => {
  const paragraph = 'A well-read correspondent studies the neighbourhood, its descriptions and literary observations. '.repeat(30).trim();
  const pages = paginateBookText(paragraph, measure);
  assert.equal(pages.map(page => page.text).join('').replace(/\s/g, ''), paragraph.replace(/\s/g, ''));
  const lines = pages.flatMap(page => page.lines);
  assert.ok(lines.some(line => line.hyphenated), 'Narrow measures should use British hyphenation');
  assert.equal(lines.filter(line => line.paragraphStart).length, 1);
  assert.equal(lines.filter(line => line.paragraphEnd).length, 1);
  assert.ok(lines.filter(line => !line.paragraphEnd).every(line => Math.abs(TYPE.left + line.runs.at(-1).x + line.runs.at(-1).width - TYPE.right) < .1));
});

test('page turns expose the correct recto and verso in both directions', () => {
  assert.deepEqual(pageFaces(0), { left: -1, right: 0, front: 0, back: 1 });
  assert.deepEqual(pageFaces(1), { left: 1, right: 2, front: 2, back: 3 });
  assert.deepEqual(pageFaces(1, true, 1), { left: 1, right: 4, front: 2, back: 3 });
  assert.deepEqual(pageFaces(2, true, -1), { left: 1, right: 4, front: 2, back: 3 });
});
