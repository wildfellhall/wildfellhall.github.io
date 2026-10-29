import * as linebreakModule from 'tex-linebreak';
import britishPatterns from './gazette-british-patterns.js';

// The upstream package is UMD with __esModule set: Vite exposes its namespace,
// while Node exposes the CommonJS object as default.
const linebreak = linebreakModule.default || linebreakModule;
const britishHyphenate = linebreak.createHyphenator(britishPatterns);
const hyphenate = word => /^[A-Za-zÀ-ÿ]{7,}[,.;:!?]?$/.test(word) ? britishHyphenate(word) : [word];

// Set a whole paragraph before choosing line endings. The positioned runs
// preserve the compositor's spacing through column and page continuations.
// Hyphens are presentation only: the editable source/transcript is untouched.
export function composePrintedText(text, width, measure, indent = 24) {
  const result = [];
  for (const paragraph of text.trim().split(/\n\s*\n/).filter(Boolean)) {
    const clean = paragraph.replace(/\s+/g, ' ').trim();
    // Provide break opportunities for otherwise unbreakable URLs and Unicode
    // tokens. Array.from preserves code points; no text is silently omitted.
    const split = word => {
      if (measure(word) <= width - indent) return hyphenate(word);
      return Array.from(word);
    };
    const items = linebreak.layoutItemsFromString(clean, measure, split);
    items.unshift({ type: 'box', width: indent, text: '' });
    const breaks = linebreak.breakLines(items, width);
    const positions = linebreak.positionItems(items, width, breaks);
    const lines = [];
    for (const position of positions) {
      const item = items[position.item], value = item.type === 'penalty' ? '-' : item.text;
      if (!value) continue;
      const line = lines[position.line] ||= { text: '', runs: [], paragraphStart: position.line === 0, paragraphEnd: false };
      line.hyphenated = item.type === 'penalty';
      const x = position.xOffset;
      const previous = line.runs.at(-1);
      if (previous && Math.abs(previous.x + previous.width - x) < .01) {
        previous.text += value; previous.width += position.width; line.text += value;
      } else {
        line.runs.push({ text: value, x, width: position.width });
        line.text += `${line.text ? ' ' : ''}${value}`;
      }
    }
    // TeX can return an overfull box when there is no legal fitting break
    // (notably a long URL or a run of wide Unicode symbols). Keep those
    // exceptional paragraphs inside the column using measured hard wraps.
    const fitted = lines.some(line => line.runs.some(run => run.x + run.width > width + .05))
      ? emergencyLines(clean, width, measure, indent) : lines;
    if (fitted.length) fitted.at(-1).paragraphEnd = true;
    result.push(...fitted);
  }
  return result;
}

function emergencyLines(text, width, measure, indent) {
  const lines = []; let current = '';
  const limit = () => width - (lines.length ? 0 : indent);
  function flush(hyphenated = false) {
    if (!current) return;
    lines.push({ text: current, runs: [{ text: current, x: lines.length ? 0 : indent, width: measure(current) }],
      paragraphStart: !lines.length, paragraphEnd: false, hyphenated });
    current = '';
  }
  for (const word of text.split(' ')) {
    if (current && measure(`${current} ${word}`) > limit()) flush();
    let remainder = word;
    while (measure(remainder) > limit()) {
      const characters = Array.from(remainder); let end = 1;
      while (end < characters.length && measure(characters.slice(0, end + 1).join('') + '-') <= limit()) end++;
      current = characters.slice(0, end).join('') + '-'; flush(true);
      remainder = characters.slice(end).join('');
    }
    current += `${current ? ' ' : ''}${remainder}`;
  }
  flush(); return lines;
}
