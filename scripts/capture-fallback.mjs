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
  for (const [name, width, height, deviceScaleFactor] of [['desk-still', 1440, 1000, 1], ['desk-still-portrait', 390, 844, 2]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor, reducedMotion: 'reduce' });
    await page.goto(url);
    await page.locator('#room.is-ready').waitFor({ timeout: 60000 });
    const capture = await page.locator('#desk').screenshot();
    await sharp(capture).webp({ quality: 92 }).toFile(new URL(`../public/materials/${name}.webp`, import.meta.url).pathname);
    console.log(`Captured ${name}.webp`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server?.close();
}
