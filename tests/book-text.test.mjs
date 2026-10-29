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
      assert.ok(line.x >= TYPE.left && line.x + measure(line.text) <= TYPE.right);
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
  assert.ok(pages.every(p => p.lines.every(line => line.x + measure(line.text) <= TYPE.right)));
});

test('page turns expose the correct recto and verso in both directions', () => {
  assert.deepEqual(pageFaces(0), { left: -1, right: 0, front: 0, back: 1 });
  assert.deepEqual(pageFaces(1), { left: 1, right: 2, front: 2, back: 3 });
  assert.deepEqual(pageFaces(1, true, 1), { left: 1, right: 4, front: 2, back: 3 });
  assert.deepEqual(pageFaces(2, true, -1), { left: 1, right: 4, front: 2, back: 3 });
});
