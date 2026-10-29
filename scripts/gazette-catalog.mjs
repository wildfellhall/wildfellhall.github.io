import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseGazette, dateLabel } from '../src/gazette-text.js';

export async function gazetteCatalog(directory) {
  const names = (await readdir(directory)).filter(name => name.endsWith('.txt')).sort().reverse();
  return Promise.all(names.map(async name => {
    try {
      const date = name.slice(0, -4), issue = parseGazette(await readFile(join(directory, name), 'utf8'), date);
      return { date: issue.date, label: dateLabel(issue.date), number: issue.number, file: `issues/${name}` };
    } catch (error) { throw new Error(`Gazette ${name}: ${error.message}`); }
  }));
}

export function gazettePlugin() {
  let directory;
  return {
    name: 'gazette-date-index',
    configResolved(config) { directory = join(config.publicDir, 'gazette/issues'); },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/gazette/index.json') return next();
        try {
          const catalog = await gazetteCatalog(directory);
          res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-cache');
          res.end(JSON.stringify(catalog));
        } catch (error) { res.statusCode = 500; res.end(error.message); }
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'gazette/index.json', source: JSON.stringify(await gazetteCatalog(directory), null, 2) });
    },
  };
}
