// Page coordinates are independent of the viewport, so resizing never moves
// the reader's place or changes which words belong to a physical leaf.
export const TYPE = Object.freeze({ width: 1024, height: 1425, left: 154, right: 870,
  top: 196, fontSize: 35, lineHeight: 46, lines: 23, indent: 35 });

export function parseBookText(source) {
  const blocks = [], paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.splice(0).join(' ').replace(/\s+/gu, ' ').trim() });
  };
  for (const raw of source.replace(/^\uFEFF/u, '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) continue;
    if (line === '---') { flush(); blocks.push({ type: 'break' }); }
    else if (!line) flush();
    else paragraph.push(line);
  }
  flush(); return blocks;
}

export function paginateBookText(source, measure, layout = TYPE) {
  const pages = [{ lines: [] }], width = layout.right - layout.left;
  let page = pages[0];
  const next = () => { page = { lines: [] }; pages.push(page); };
  for (const block of parseBookText(source)) {
    if (block.type === 'break') { next(); continue; }
    const words = block.text.split(' '), lines = [];
    let index = 0;
    while (index < words.length) {
      const indent = lines.length ? 0 : layout.indent, available = width - indent;
      let text = '';
      while (index < words.length) {
        const candidate = text ? `${text} ${words[index]}` : words[index];
        if (measure(candidate) <= available) { text = candidate; index++; continue; }
        if (text) break;
        // Even an unbroken URL or a long Unicode word must make progress.
        const glyphs = Array.from(words[index]);
        let lo = 1, hi = glyphs.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (measure(glyphs.slice(0, mid).join('')) <= available) lo = mid;
          else hi = mid - 1;
        }
        text = glyphs.slice(0, lo).join('');
        words[index] = glyphs.slice(lo).join('');
        if (!words[index]) index++;
        break;
      }
      lines.push({ text, indent, paragraphStart: lines.length === 0, paragraphEnd: index === words.length });
    }
    let cursor = 0;
    while (cursor < lines.length) {
      let room = layout.lines - page.lines.length, remaining = lines.length - cursor;
      if (!room || (room === 1 && remaining > 1 && page.lines.length)) { next(); room = layout.lines; }
      let take = Math.min(room, remaining);
      if (remaining > take && remaining - take === 1 && take > 2) take--;
      for (const line of lines.slice(cursor, cursor + take)) {
        page.lines.push({ ...line, x: layout.left + line.indent,
          y: layout.top + layout.fontSize + page.lines.length * layout.lineHeight });
      }
      cursor += take;
      if (cursor < lines.length) next();
    }
  }
  return pages.map(page => ({ ...page, text: page.lines.map((line, i) =>
    `${i && line.paragraphStart ? '\n\n' : i ? ' ' : ''}${line.text}`).join('') }));
}

// One physical leaf has a recto and a verso. During a turn the stationary
// stacks expose the pages underneath, while the moving leaf keeps both faces.
export function pageFaces(page, turning = false, direction = 1) {
  const leaf = direction > 0 ? page : page - 1;
  return {
    left: 2 * (page - (turning && direction < 0 ? 1 : 0)) - 1,
    right: 2 * (page + (turning && direction > 0 ? 1 : 0)),
    front: 2 * leaf, back: 2 * leaf + 1,
  };
}
