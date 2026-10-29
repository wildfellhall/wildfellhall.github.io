// Capture the actual procedural scene for browsers without WebGL.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import sharp from 'sharp';

let server, browser;
try {
  const url = process.env.CAPTURE_URL || 'http://127.0.0.1:4191/';
  if (!process.env.CAPTURE_URL) {
    server = await createServer({ server: { host: '127.0.0.1', port: 4191, strictPort: true } });
    await server.listen();
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  // Capture portrait at the picture source's widest aspect ratio. object-fit:
  // cover then crops its sides like the orthographic camera on narrower phones.
  // The wide camera preserves vertical room for the feet, so it needs its own
  // still rather than cropping the feet off the standard landscape image.
  for (const [name, width, height, deviceScaleFactor] of [['desk-still', 1440, 1000, 1], ['desk-still-portrait', 630, 840, 2], ['desk-still-wide', 2560, 1080, 1]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor, reducedMotion: 'reduce' });
    await page.goto(url);
    await page.locator('#room.is-ready').waitFor({ timeout: 90000 });
    // Let the first rendered frame replace the previous still before capture.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    // Element screenshots include overlapping siblings. Keep controls and the
    // CSS vignette out of the still; the fallback supplies its own vignette.
    await page.addStyleTag({ content: '.desk-controls, .room-vignette { visibility: hidden !important; }' });
    const capture = await page.locator('#desk').screenshot();
    await sharp(capture).webp({ quality: 92 }).toFile(new URL(`../public/materials/${name}.webp`, import.meta.url).pathname);
    console.log(`Captured ${name}.webp`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server?.close();
}
