// Render the live Three.js frame into transparent stills for context recovery.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import sharp from 'sharp';

let server, browser;
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 4192, strictPort: true } });
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 200 }, deviceScaleFactor: 2 });
  await page.route('**/control-frame-capture', route => route.fulfill({ contentType: 'text/html',
    body: '<div id="frame" style="width:308px;height:86px"><canvas style="width:100%;height:100%"></canvas></div>' }));
  await page.goto('http://127.0.0.1:4192/control-frame-capture');
  for (const [prefix, width, height, portrait] of [
    ['control-frame', 308, 86, false], ['archive-frame', 490, 460, true],
    ['archive-frame-mobile', 366, 460, true],
  ]) {
    const captures = await page.evaluate(async ({ width, height, portrait }) => {
      const { createControlFrame } = await import('/src/control-frame.js');
      const host = document.querySelector('#frame'); host.open = true;
      host.style.width = `${width}px`; host.style.height = `${height}px`;
      const frame = await createControlFrame(host, { portrait });
      const images = [];
      for (const light of [0, 1]) { frame.render(light); images.push(host.querySelector('canvas').toDataURL()); }
      frame.dispose(); return images;
    }, { width, height, portrait });
    for (const [i, name] of ['day', 'evening'].entries()) {
      await sharp(Buffer.from(captures[i].split(',')[1], 'base64')).webp({ quality: 96, alphaQuality: 100 })
        .toFile(new URL(`../public/materials/${prefix}-${name}.webp`, import.meta.url).pathname);
      console.log(`Captured ${prefix}-${name}.webp`);
    }
  }
} finally { await browser?.close(); await server?.close(); }
