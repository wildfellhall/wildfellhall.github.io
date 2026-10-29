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
  const issue = { date: '', number: '', sections: SECTIONS.map(([id, label]) => ({ id, label, title: '', subtitle: '', byline: '', body: '' })) };
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
    const field = !prose && /^(title|subtitle|byline):\s*(.*)$/.exec(line);
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

// Printer's units on a 1400 × 1900 broadsheet. A four-page edition has a
// front page, further articles, a literary page and a miscellany page.
// Continuations are inserted immediately after their original page.
export const GAZETTE_TYPE = Object.freeze({ width: 1400, height: 1900, fontSize: 27, leading: 31, bottom: 1750 });
export const EDITION = Object.freeze([
  { name: 'Articles', sections: [{ id: 'article-1', x: 78, width: 810, columns: 2, headline: 52 },
    { id: 'article-2', x: 934, width: 388, columns: 1, headline: 38 }] },
  { name: 'Articles & Correspondence', sections: [{ id: 'article-3', x: 78, width: 1244, columns: 3, headline: 52 }] },
  { name: 'The Literary Cabinet', sections: [{ id: 'thought-a-day', x: 78, width: 388, columns: 1, headline: 38 },
    { id: 'words-of-the-week', x: 512, width: 810, columns: 2, headline: 44 }] },
  { name: 'Notices & Miscellany', sections: [{ id: 'miscellaneous', x: 78, width: 1244, columns: 3, headline: 52 }] },
]);

export function paginateGazette(issue, measure, titleMeasure) {
  const pages = [];
  for (const [templateIndex, template] of EDITION.entries()) {
    const stories = template.sections.map(area => {
      const section = issue.sections.find(s => s.id === area.id);
      const columnWidth = (area.width - (area.columns - 1) * 36) / area.columns;
      // Headlines, decks and bylines wrap using their actual type size.
      const titles = wrapText(section.title || section.label, area.width - 20, s => titleMeasure(s) * area.headline / 38);
      const subtitles = wrapText(section.subtitle, area.width - 28, measure);
      const bylines = wrapText(section.byline, area.width - 28, measure);
      return { ...section, ...area, columnWidth, titles, subtitles, bylines,
        remaining: wrapText(section.body, columnWidth, measure), used: false };
    });
    let continuation = false;
    do {
      const front = templateIndex === 0 && !continuation, top = front ? 720 : 310;
      const sections = stories.filter(s => !s.used || s.remaining.length).map(story => {
        const continued = story.used;
        const headerHeight = 74 + story.titles.length * (story.headline + 8)
          + story.subtitles.length * 33 + story.bylines.length * 29 + (continued ? 33 : 0);
        const bodyY = top + headerHeight;
        const capacity = Math.floor((GAZETTE_TYPE.bottom - 45 - bodyY) / GAZETTE_TYPE.leading);
        if (capacity < 3) throw new Error(`The heading for ${story.label} is too long. Shorten its title, subtitle or byline.`);
        const columns = Array.from({ length: story.columns }, () => story.remaining.splice(0, capacity));
        story.used = true;
        return { ...story, remaining: undefined, top, bodyY, columns, continued,
          lines: columns.flat(), continues: story.remaining.length > 0 };
      });
      pages.push({ name: template.name, front, sections }); continuation = true;
    } while (stories.some(story => story.remaining.length));
  }
  const contents = issue.sections.map(section => ({ id: section.id, label: section.title || section.label,
    page: pages.findIndex(page => page.sections.some(s => s.id === section.id)) + 1 }));
  for (const [index, page] of pages.entries()) {
    page.number = index + 1; page.contents = contents;
    for (const story of page.sections) {
      story.previousPage = story.continued ? pages.findLastIndex((p, i) => i < index && p.sections.some(s => s.id === story.id)) + 1 : null;
      story.nextPage = story.continues ? pages.findIndex((p, i) => i > index && p.sections.some(s => s.id === story.id)) + 1 : null;
    }
  }
  return pages;
}
