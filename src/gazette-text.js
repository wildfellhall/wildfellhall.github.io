export const SECTIONS = Object.freeze([
  ['article-1', 'Article I'], ['article-2', 'Article II'], ['article-3', 'Article III'],
  ['thought-a-day', 'Thought a Day'], ['words-of-the-week', 'Words of the Week'], ['miscellaneous', 'Miscellany'],
]);

export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) > 0
    && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime())
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function dateLabel(date) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}

// Deliberately plain text. Metadata belongs before the first empty line in
// each section; everything after it is prose, including colons and brackets.
export function parseGazette(source, expectedDate) {
  const issue = { date: '', number: '', sections: SECTIONS.map(([id, label]) => ({ id, label, title: '', byline: '', body: '' })) };
  let section = null, prose = false;
  const seen = new Set();
  for (const raw of source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) continue;
    const heading = /^\[([a-z0-9-]+)\]$/.exec(line);
    if (heading) {
      section = issue.sections.find(item => item.id === heading[1]);
      if (!section || seen.has(heading[1])) throw new Error(`Unknown or repeated section: ${heading[1]}`);
      seen.add(section.id); prose = false; continue;
    }
    if (!section) {
      if (!line) continue;
      const field = /^(date|number):\s*(.*)$/.exec(line);
      if (!field) throw new Error(`Unknown issue field: ${line}`);
      issue[field[1]] = field[2]; continue;
    }
    if (!line) { prose = true; section.body += '\n'; continue; }
    const field = !prose && /^(title|byline):\s*(.*)$/.exec(line);
    if (field) section[field[1]] = field[2];
    else { prose = true; section.body += `${raw}\n`; }
  }
  if (!validDate(issue.date)) throw new Error('Use a real date in YYYY-MM-DD format.');
  if (expectedDate && issue.date !== expectedDate) throw new Error('The date must match the issue filename.');
  if (seen.size !== SECTIONS.length) throw new Error(`Include all six sections: ${SECTIONS.map(([id]) => `[${id}]`).join(', ')}`);
  for (const section of issue.sections) section.body = section.body.trim();
  return issue;
}

export function wrapText(text, width, measure) {
  const lines = [];
  for (const paragraph of text.trim().split(/\n\s*\n/)) {
    if (!paragraph.trim()) continue;
    if (lines.length) lines.push('');
    let current = '';
    for (const word of paragraph.replace(/\s+/g, ' ').trim().split(' ')) {
      if (current && measure(`${current} ${word}`) > width) { lines.push(current); current = ''; }
      // Split long URLs and long words without dropping any characters.
      let remainder = word;
      while (measure(remainder) > width) {
        if (current) { lines.push(current); current = ''; }
        const letters = Array.from(remainder); let end = 1;
        while (end < letters.length && measure(letters.slice(0, end + 1).join('')) <= width) end++;
        lines.push(letters.slice(0, end).join('')); remainder = letters.slice(end).join('');
      }
      current += `${current ? ' ' : ''}${remainder}`;
    }
    if (current) lines.push(current);
  }
  return lines;
}

// A section keeps its own column. Longer articles continue onto additional
// sheets; no clipping, shrinking the type, or hidden character limits.
export function paginateGazette(issue, measure, titleMeasure) {
  const columns = issue.sections.map(section => {
    const titles = wrapText(section.title || section.label, 370, titleMeasure);
    const bylines = wrapText(section.byline, 370, measure);
    const lines = wrapText(section.body, 370, measure);
    const capacity = Math.max(4, Math.floor((section.id.startsWith('article') ? 680 : 420) / 30) - titles.length * 2 - bylines.length);
    const chunks = [];
    for (let i = 0; i < Math.max(1, lines.length); i += capacity) chunks.push(lines.slice(i, i + capacity));
    return { ...section, titles, bylines, chunks };
  });
  return Array.from({ length: Math.max(...columns.map(item => item.chunks.length)) }, (_, page) => ({
    sections: columns.map(item => ({ ...item, lines: item.chunks[page] || [], continued: page > 0 && Boolean(item.chunks[page]) })),
  }));
}
